const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path'); // For path.join and __dirname
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load environment variables immediately
dotenv.config();

// --- Import your custom modules ---
// Connect to MongoDB
const connectDB = require('./config/db'); // Using the connectDB function from config/db.js

// Game Services and API Routes
const gameService = require('./services/gameService'); // This service will contain startGameLoop, placeBet, cashOut, etc.
const playerRoutes = require('./api/playerRoutes'); // Routes for player operations
const betRoutes = require('./api/betRoutes');     // Routes for betting operations
const roundRoutes = require('./api/roundRoutes'); // Routes for fetching round info

// NOTE: cryptoService is primarily used internally by gameService and other services,
// not usually imported directly into the main server.js for API calls.
// The getCryptoPrice you had was a local placeholder.
// The actual service function is `fetchCryptoPrice` from `cryptoService.js`.

const app = express();
const server = http.createServer(app); // Create HTTP server for Express and WS

// --- Middleware ---
app.use(express.json()); // To parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files (if you have a 'public' folder for a simple client)

// --- Database Connection ---
connectDB(); // Call the function to connect to MongoDB

// --- WebSocket Setup ---
// Initialize WebSockets, passing the HTTP server instance
// and potentially the gameService to allow WS to trigger game actions
const wss = new WebSocket.Server({ server });

wss.on('connection', async (ws) => {
    console.log('Client connected to WebSocket.');

    // Pass the WebSocket client to gameService for real-time updates if needed
    // (though gameService will usually broadcast to all clients)
    // You might want to send initial state to a new client here or via gameService.

    ws.on('message', async (message) => {
        // This is where clients send messages, e.g., cashout requests
        try {
            const parsedMessage = JSON.parse(message.toString());
            // You can route WebSocket messages to your gameService or relevant controller
            if (parsedMessage.event === 'cashoutRequest') {
                const { playerId, betId } = parsedMessage.data;
                console.log(`Cashout request received from ${playerId} for bet ${betId}`);
                const result = await gameService.cashOut(playerId, betId); // Call game service
                ws.send(JSON.stringify({ event: 'cashoutResponse', data: result })); // Send response back to specific client
            }
            // Add other WebSocket event handlers as needed
        } catch (error) {
            console.error('Error parsing WebSocket message or handling event:', error);
            ws.send(JSON.stringify({ event: 'error', data: 'Invalid message format or server error.' }));
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket.');
        // Game service might need to know about client counts for pausing/resuming
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// --- Start Game Loop (Managed by gameService) ---
// This call will initiate the recurring game rounds and multiplier updates
gameService.startGameLoop(wss); // Pass the WebSocket server instance to gameService

// --- API Routes ---
app.use('/api', playerRoutes); // e.g., /api/player/:playerId/wallet
app.use('/api', betRoutes);     // e.g., /api/bet, /api/cashout
app.use('/api', roundRoutes);   // e.g., /api/round/current, /api/rounds

// Basic health check route
app.get('/', (req, res) => {
    res.send('Crypto Crash Game Backend is running!');
});

// --- Server Listener ---
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
