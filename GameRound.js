// models/GameRound.js
const mongoose = require('mongoose');

const GameRoundSchema = new mongoose.Schema({
  roundId: { type: String, unique: true, required: true },
  crashPoint: { type: Number, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  status: { type: String, enum: ['in_progress', 'crashed', 'completed'], default: 'in_progress' },
  seed: { type: String, required: true }, // For provably fair
  salt: { type: String, required: true }, // For provably fair
  bets: [
    {
      playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player' },
      usdAmount: { type: Number, required: true },
      cryptoAmount: { type: Number, required: true },
      currency: { type: String, required: true },
      betPoint: { type: Number, default: 1.0 }, // Multiplier at which they bet (always 1x for crash)
      cashOutPoint: { type: Number },
      outcome: { type: String, enum: ['win', 'loss'], default: 'loss' },
      timestamp: { type: Date, default: Date.now }
    }
  ],
  transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }]
});

module.exports = mongoose.model('GameRound', GameRoundSchema);