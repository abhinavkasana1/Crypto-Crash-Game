// controllers/gameController.js
const GameRound = require('../models/GameRound');
const Player = require('../models/Player');
const Transaction = require('../models/Transaction');
const { getCryptoPrice } = require('../services/cryptoService');
const { generateSeed, generateSalt, calculateCrashPoint } = require('../services/fairAlgorithm');
const mongoose = require('mongoose');

let currentRound = null;
let currentMultiplier = 1.00;
let gameInterval = null;
let broadcastClients = []; // WebSocket clients

const ROUND_START_DELAY = 5000; // 5 seconds between rounds after crash (adjusted for demonstration)
const MULTIPLIER_UPDATE_INTERVAL = 100; // 100ms for updates
const GAME_GROWTH_FACTOR = 0.05; // Adjust for faster/slower exponential growth

const startNewRound = async () => {
  // Clear any existing interval
  if (gameInterval) clearInterval(gameInterval);

  const serverSeed = generateSeed();
  const clientSeed = generateSalt(); // Client seed could also be provided by client later
  const nonce = 0; // Round number / nonce for provably fair algorithm

  const crashPoint = calculateCrashPoint(serverSeed, clientSeed, nonce);

  currentRound = new GameRound({
    roundId: new mongoose.Types.ObjectId().toString(),
    crashPoint,
    seed: serverSeed,
    salt: clientSeed, // Using salt as clientSeed for simplicity in this demo
    status: 'in_progress',
    startTime: Date.now(),
    bets: [] // Clear bets for new round
  });

  await currentRound.save();

  currentMultiplier = 1.00;
  console.log(`New round started! Round ID: ${currentRound.roundId}, Crash Point: x${crashPoint}`);
  broadcast({ type: 'ROUND_START', roundId: currentRound.roundId, crashPoint, serverSeed, clientSeed, nonce });

  let timeElapsed = 0;
  gameInterval = setInterval(async () => {
    timeElapsed += MULTIPLIER_UPDATE_INTERVAL;
    // Exponential multiplier formula (e.g., multiplier = 1 + A * (e^(B * timeElapsed)))
    // Simplified: multiplier = 1 + (timeElapsed / 1000) * growth_factor
    // More exponential: multiplier = Math.pow(2, timeElapsed / 1000 / some_factor)
    // Let's use a simpler exponential curve: 1 + time * growth_factor
    currentMultiplier = parseFloat((1 + (timeElapsed / 1000) * GAME_GROWTH_FACTOR).toFixed(2));
    if (currentMultiplier < 1.01) currentMultiplier = 1.01; // Ensure minimum display multiplier

    if (currentMultiplier >= currentRound.crashPoint) {
      clearInterval(gameInterval);
      currentRound.status = 'crashed';
      currentRound.endTime = Date.now();
      await currentRound.save(); // Save round status

      console.log(`Game CRASHED at x${currentRound.crashPoint}!`);
      broadcast({ type: 'CRASH', crashPoint: currentRound.crashPoint });

      // Process losses for players who didn't cash out (no action needed, they just lose)
      // For demonstration, no explicit loss transaction recorded beyond bet in GameRound

      setTimeout(startNewRound, ROUND_START_DELAY);
    } else {
      broadcast({ type: 'UPDATE', multiplier: currentMultiplier });
    }
  }, MULTIPLIER_UPDATE_INTERVAL);
};

const broadcast = (data) => {
  broadcastClients.forEach((client) => {
    if (client.readyState === require('ws').OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

const addClient = (ws) => {
  broadcastClients.push(ws);
  // Send current game state to new client
  ws.send(JSON.stringify({ type: 'PRICE', price: getCryptoPrice('BTC') })); // Initial BTC price
  if (currentRound && currentRound.status === 'in_progress') {
    ws.send(JSON.stringify({ type: 'ROUND_START', roundId: currentRound.roundId, crashPoint: currentRound.crashPoint, serverSeed: currentRound.seed, clientSeed: currentRound.salt, nonce: 0 }));
    ws.send(JSON.stringify({ type: 'UPDATE', multiplier: currentMultiplier }));
  } else if (currentRound && currentRound.status === 'crashed') {
    ws.send(JSON.stringify({ type: 'CRASH', crashPoint: currentRound.crashPoint }));
  }
};

const removeClient = (ws) => {
  broadcastClients = broadcastClients.filter((client) => client !== ws);
};

// WebSocket message handler for cashout requests
const handleCashoutRequest = async (ws, data) => {
  if (!data.playerId || !data.roundId) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Invalid cashout request data.' }));
    return;
  }

  // Basic validation
  if (!currentRound || currentRound.roundId !== data.roundId || currentRound.status !== 'in_progress') {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'Cannot cash out. Round not in progress or invalid round ID.' }));
    return;
  }

  const sessionPlayerId = data.playerId; // Assume playerId is sent by client for simplicity
  const playerObjectId = await Player.findOne({ playerId: sessionPlayerId }).select('_id');

  if (!playerObjectId) {
      ws.send(JSON.stringify({ type: 'ERROR', message: 'Player not found.' }));
      return;
  }

  // Check if player already cashed out in this round
  const existingBet = currentRound.bets.find(
    (bet) => bet.playerId.equals(playerObjectId._id) && bet.cashOutPoint
  );

  if (existingBet) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'You have already cashed out in this round.' }));
    return;
  }

  // Find the player's bet for this round
  const playerBetIndex = currentRound.bets.findIndex(
    (bet) => bet.playerId.equals(playerObjectId._id) && !bet.cashOutPoint
  );

  if (playerBetIndex === -1) {
    ws.send(JSON.stringify({ type: 'ERROR', message: 'No active bet found for this player in current round.' }));
    return;
  }

  const playerBet = currentRound.bets[playerBetIndex];
  const cashOutMultiplier = currentMultiplier; // Use the multiplier at the exact moment of cashout request

  // Ensure atomicity for balance updates
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const player = await Player.findById(playerObjectId._id).session(session);
    if (!player) {
      throw new Error('Player not found during cashout transaction.');
    }

    const priceAtCashout = await getCryptoPrice(playerBet.currency);
    if (!priceAtCashout) {
      throw new Error(`Could not get current price for ${playerBet.currency} for cashout.`);
    }

    const payoutCrypto = playerBet.cryptoAmount * cashOutMultiplier;
    const payoutUSD = payoutCrypto * priceAtCashout;

    player.balance.set(playerBet.currency, player.balance.get(playerBet.currency) + payoutCrypto);
    await player.save({ session });

    // Update bet in current round
    currentRound.bets[playerBetIndex].cashOutPoint = cashOutMultiplier;
    currentRound.bets[playerBetIndex].outcome = 'win';
    await currentRound.save({ session });

    // Create transaction log
    const transaction = new Transaction({
      playerId: player._id,
      gameRoundId: currentRound._id,
      usdAmount: payoutUSD,
      cryptoAmount: payoutCrypto,
      currency: playerBet.currency,
      transactionType: 'cashout',
      transactionHash: `MOCK_TX_${Date.now()}_${player._id}`, // Mock hash
      priceAtTime: priceAtCashout
    });
    await transaction.save({ session });

    // Add transaction to game round's transactions list
    currentRound.transactions.push(transaction._id);
    await currentRound.save({ session });

    await session.commitTransaction();

    ws.send(JSON.stringify({
      type: 'CASHOUT_SUCCESS',
      cashOutMultiplier: cashOutMultiplier,
      payoutCrypto: payoutCrypto.toFixed(8),
      payoutUSD: payoutUSD.toFixed(2),
      currency: playerBet.currency,
      newBalanceCrypto: player.balance.get(playerBet.currency).toFixed(8),
      newBalanceUSD: (player.balance.get(playerBet.currency) * priceAtCashout).toFixed(2)
    }));

    // Notify all clients of player cashout
    broadcast({
      type: 'PLAYER_CASHOUT',
      playerId: data.playerId, // Send player ID (username if available)
      cashOutPoint: cashOutMultiplier.toFixed(2),
      payoutUSD: payoutUSD.toFixed(2)
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Cashout failed:', error);
    ws.send(JSON.stringify({ type: 'ERROR', message: `Cashout failed: ${error.message}` }));
  } finally {
    session.endSession();
  }
};


module.exports = {
  startNewRound,
  broadcast,
  addClient,
  removeClient,
  handleCashoutRequest
};