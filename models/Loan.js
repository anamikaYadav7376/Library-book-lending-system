const mongoose = require('mongoose');

const loanSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User reference is required']
  },
  book: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: [true, 'Book reference is required']
  },
  issueDate: {
    type: Date,
    default: Date.now
  },
  dueDate: {
    type: Date,
    default: () => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
  },
  returnDate: {
    type: Date
  },
  status: {
    type: String,
    enum: ['requested', 'issued', 'returned', 'overdue'],
    default: 'issued'
  },
  fine: {
    type: Number,
    default: 0,
    min: [0, 'Fine cannot be negative']
  }
});

// Helper function to calculate fine and current status dynamically
loanSchema.methods.getCalculatedStatusAndFine = function () {
  const now = new Date();
  const dueDate = new Date(this.dueDate);
  const FINE_PER_DAY = 5;

  if (this.status === 'returned') {
    if (this.returnDate && new Date(this.returnDate) > dueDate) {
      const diffMs = new Date(this.returnDate) - dueDate;
      const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      return {
        status: 'returned',
        overdueDays: Math.max(0, overdueDays),
        fine: Math.max(0, overdueDays * FINE_PER_DAY),
        isOverdue: false
      };
    }
    return {
      status: 'returned',
      overdueDays: 0,
      fine: this.fine || 0,
      isOverdue: false
    };
  }

  // Active loan (issued or overdue)
  if (now > dueDate) {
    const diffMs = now - dueDate;
    const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const calculatedFine = overdueDays * FINE_PER_DAY;
    return {
      status: 'overdue',
      overdueDays,
      fine: calculatedFine,
      isOverdue: true
    };
  }

  return {
    status: this.status,
    overdueDays: 0,
    fine: 0,
    isOverdue: false
  };
};

module.exports = mongoose.model('Loan', loanSchema);
