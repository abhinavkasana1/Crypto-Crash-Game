const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const path = require('path');
const dotenv = require('dotenv'); // <--- ADD THIS
const mongoose = require('mongoose'); // <--- ADD THIS

// Import your custom service, controllers, and routes
const { getCryptoPrice } = require('./services/cryptoService'); // <--- USE THIS FOR CRYPTO PRICE
// Make sure these files/folders exist as per previous instructions
// const gameController = require('./controllers/gameController');
// const userController = require('./controllers/userController');
// const apiRoutes = require('./routes/api');

dotenv.config(); // Load environment variables from .env

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json()); // To parse JSON request bodies for API routes
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected...'))
  .catch(err => console.error('MongoDB connection error:', err));

// API Routes (Uncomment and set up once controllers/routes files are confirmed)
// app.use('/api', apiRoutes); // Mount your API routes

let clients = [];
let gameInProgress = false;
let crashPoint = 0;
let multiplier = 1.0;
let interval;
let lastCrashPoint = 0; // To store the last crash point

// REMOVE the old getCryptoPrice function that was directly in server.js

const startGame = async () => { // Make it async because getCryptoPrice is async
  gameInProgress = true;
  // In a real game, crashPoint would be determined by provably fair algorithm
  crashPoint = parseFloat((Math.random() * 2 + 1.5).toFixed(2)); // Basic random for now
  multiplier = 1.0;

  // Reset multiplier display for all clients at game start
  broadcast({ type: 'UPDATE', multiplier: 1.0 });

  interval = setInterval(() => {
    multiplier = parseFloat((multiplier + 0.01).toFixed(2)); // Increased precision
    broadcast({ type: 'UPDATE', multiplier });

    if (multiplier >= crashPoint) {
      clearInterval(interval);
      lastCrashPoint = crashPoint; // Store the crash point
      broadcast({ type: 'CRASH', crashPoint });
      gameInProgress = false;
      // After a crash, wait before starting the next game
      setTimeout(startGame, 5000); // Wait 5 seconds before next round
    }
  }, 100); // Update multiplier every 100ms for smoother animation
};

const broadcast = (data) => {
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

wss.on('connection', async (ws) => {
  clients.push(ws);
  console.log('Client connected');

  // Send initial BTC price and game state to new client
  const price = await getCryptoPrice(); // <--- CALLS THE NEW CRYPTO SERVICE
  if (price !== null) {
    ws.send(JSON.stringify({ type: 'PRICE', price }));
  }

  // Send current multiplier and crashPoint if game is in progress
  if (gameInProgress) {
    ws.send(JSON.stringify({ type: 'UPDATE', multiplier }));
  } else if (lastCrashPoint > 0) { // If game not in progress, but a game just crashed
    ws.send(JSON.stringify({ type: 'CRASH', crashPoint: lastCrashPoint }));
  }

  // If no game is in progress, start one for the first connected client
  if (!gameInProgress) {
    startGame();
  }

  ws.on('message', async (message) => {
    const data = JSON.parse(message);
    // Handle incoming WebSocket messages, e.g., cashout requests
    // This will be handled by gameController later. For now, it's a placeholder.
    if (data.type === 'CASHOUT') {
        console.log(`Cashout request from client at multiplier: ${multiplier}`);
        // Integrate gameController.cashOut logic here later
        // ws.send(JSON.stringify({ type: 'CASHOUT_CONFIRM', message: 'Cashout request received' }));
    }
  });

  ws.on('close', () => {
    clients = clients.filter((client) => client !== ws);
    console.log('Client disconnected');
    // If no clients are left and game is running, you might want to stop game or pause
    if (clients.length === 0 && gameInProgress) {
        clearInterval(interval);
        gameInProgress = false;
        console.log('No clients, game paused.');
    }
  });
});

server.listen(process.env.PORT || 8080, () => {
  console.log(`Server running on http://localhost:${process.env.PORT || 8080}`);
  console.log(`WebSocket server running on ws://localhost:${process.env.PORT || 8080}`);
});