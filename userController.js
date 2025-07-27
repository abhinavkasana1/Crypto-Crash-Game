// controllers/userController.js
const Player = require('../models/Player');
const Transaction = require('../models/Transaction');
const { getCryptoPrice } = require('../services/cryptoService');
const mongoose = require('mongoose');
const gameController = require('./gameController'); // To access currentRound

// Helper to validate player ID (for simplicity, assumes it exists for now)
const getPlayerById = async (req, res, next) => {
  const { playerId } = req.params;
  const player = await Player.findOne({ playerId });
  if (!player) {
    return res.status(404).json({ message: 'Player not found.' });
  }
  req.player = player;
  next();
};

// [POST] /api/players/register
const registerPlayer = async (req, res) => {
  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ message: 'Username is required.' });
  }

  try {
    const existingPlayer = await Player.findOne({ username });
    if (existingPlayer) {
      return res.status(409).json({ message: 'Username already taken.' });
    }

    const player = new Player({
      playerId: new mongoose.Types.ObjectId().toString(), // Generate a unique ID
      username,
      balance: { BTC: 0.05, ETH: 0.1 } // Give some initial demo balance
    });
    await player.save();
    res.status(201).json({ message: 'Player registered successfully.', playerId: player.playerId, username: player.username, balance: player.balance });
  } catch (error) {
    console.error('Error registering player:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// [GET] /api/players/:playerId/balance
const getPlayerBalance = async (req, res) => {
  const player = req.player; // From getPlayerById middleware
  try {
    const btcPrice = await getCryptoPrice('BTC');
    const ethPrice = await getCryptoPrice('ETH');

    const balanceUSD = {};
    if (btcPrice) balanceUSD.BTC = player.balance.get('BTC') * btcPrice;
    if (ethPrice) balanceUSD.ETH = player.balance.get('ETH') * ethPrice;

    res.json({
      playerId: player.playerId,
      username: player.username,
      balanceCrypto: Object.fromEntries(player.balance),
      balanceUSD
    });
  } catch (error) {
    console.error('Error fetching player balance:', error);
    res.status(500).json({ message: 'Server error fetching balance.' });
  }
};

// [POST] /api/game/bet
const placeBet = async (req, res) => {
  const { playerId, usdAmount, currency } = req.body; // currency: 'BTC' or 'ETH'

  if (!playerId || !usdAmount || !currency) {
    return res.status(400).json({ message: 'Player ID, USD amount, and currency are required.' });
  }
  if (usdAmount <= 0) {
    return res.status(400).json({ message: 'Bet amount must be positive.' });
  }
  if (!['BTC', 'ETH'].includes(currency.toUpperCase())) {
    return res.status(400).json({ message: 'Unsupported cryptocurrency. Only BTC or ETH allowed.' });
  }

  // Ensure a game round is in progress
  if (!gameController.currentRound || gameController.currentRound.status !== 'in_progress') {
    return res.status(400).json({ message: 'No game round in progress to place a bet.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const player = await Player.findOne({ playerId }).session(session);
    if (!player) {
      throw new Error('Player not found.');
    }

    // Check if player already bet in this round
    const existingBet = gameController.currentRound.bets.find(
      (bet) => bet.playerId.equals(player._id) && !bet.cashOutPoint
    );
    if (existingBet) {
      throw new Error('You have already placed a bet in this round.');
    }

    const currentPrice = await getCryptoPrice(currency);
    if (!currentPrice) {
      throw new Error(`Could not get current price for ${currency}.`);
    }

    const cryptoAmount = usdAmount / currentPrice;

    if (player.balance.get(currency) < cryptoAmount) {
      throw new Error(`Insufficient ${currency} balance. You need ${cryptoAmount.toFixed(8)} ${currency}, but have ${player.balance.get(currency).toFixed(8)}.`);
    }

    // Deduct crypto from player balance
    player.balance.set(currency, player.balance.get(currency) - cryptoAmount);
    await player.save({ session });

    // Add bet to current game round
    gameController.currentRound.bets.push({
      playerId: player._id,
      usdAmount,
      cryptoAmount,
      currency,
      betPoint: 1.0 // Always 1x for initial bet
    });
    await gameController.currentRound.save({ session });

    // Create transaction log
    const transaction = new Transaction({
      playerId: player._id,
      gameRoundId: gameController.currentRound._id,
      usdAmount,
      cryptoAmount,
      currency,
      transactionType: 'bet',
      transactionHash: `MOCK_TX_${Date.now()}_${player._id}`, // Mock hash
      priceAtTime: currentPrice
    });
    await transaction.save({ session });

    // Add transaction to game round's transactions list
    gameController.currentRound.transactions.push(transaction._id);
    await gameController.currentRound.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: 'Bet placed successfully!',
      usdAmount,
      cryptoAmount: cryptoAmount.toFixed(8),
      currency,
      newBalance: player.balance.get(currency).toFixed(8),
      newBalanceUSD: (player.balance.get(currency) * currentPrice).toFixed(2)
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Bet placement failed:', error);
    res.status(500).json({ message: `Bet placement failed: ${error.message}` });
  } finally {
    session.endSession();
  }
};

// [GET] /api/game/history
const getGameHistory = async (req, res) => {
  try {
    // Fetch recent 10 game rounds, populate bets with player username
    const gameHistory = await GameRound.find({})
      .sort({ startTime: -1 })
      .limit(10)
      .populate({
        path: 'bets.playerId',
        select: 'username playerId' // Select specific fields from Player model
      })
      .exec();

    res.json(gameHistory);
  } catch (error) {
    console.error('Error fetching game history:', error);
    res.status(500).json({ message: 'Server error fetching game history.' });
  }
};

module.exports = {
  getPlayerById,
  registerPlayer,
  getPlayerBalance,
  placeBet,
  getGameHistory
};
