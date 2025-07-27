// models/Transaction.js
const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
  playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
  gameRoundId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameRound' },
  usdAmount: { type: Number }, // Original USD amount (for bets/payouts)
  cryptoAmount: { type: Number, required: true },
  currency: { type: String, required: true },
  transactionType: { type: String, enum: ['bet', 'cashout', 'deposit', 'withdrawal'], required: true },
  transactionHash: { type: String }, // Mock hash
  priceAtTime: { type: Number, required: true }, // USD per crypto at time of transaction
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', TransactionSchema);