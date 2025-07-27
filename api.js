// routes/api.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const gameController = require('../controllers/gameController');

// Player/Wallet routes
router.post('/players/register', userController.registerPlayer);
router.get('/players/:playerId/balance', userController.getPlayerById, userController.getPlayerBalance);

// Game routes (HTTP API - for placing bets)
router.post('/game/bet', userController.placeBet);
router.get('/game/history', userController.getGameHistory);

module.exports = router;