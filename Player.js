// models/Player.js
const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  playerId: { type: String, unique: true, required: true }, // Simple ID for now
  username: { type: String, unique: true, required: true },
  balance: { type: Map, of: Number, default: { BTC: 0, ETH: 0 } }, // Store crypto balances
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Player', PlayerSchema);