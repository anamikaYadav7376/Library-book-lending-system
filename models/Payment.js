const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  loan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Loan',
    required: [true, 'Loan reference is required']
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Payment amount cannot be negative']
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['pending', 'paid', 'failed'],
    default: 'paid'
  },
  paymentMethod: {
    type: String,
    enum: ['UPI', 'Card', 'Cash', 'Mock Payment'],
    default: 'UPI'
  },
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    unique: true,
    trim: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for query optimization
paymentSchema.index({ user: 1, paymentDate: -1 });

module.exports = mongoose.model('Payment', paymentSchema);
