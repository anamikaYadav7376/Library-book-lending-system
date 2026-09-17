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
  },
  finePaid: {
    type: Boolean,
    default: false
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  }
});

// Helper function to calculate fine and current status dynamically
loanSchema.methods.getCalculatedStatusAndFine = function () {
  const now = new Date();
  const dueDate = new Date(this.dueDate);
  const FINE_PER_DAY = 5;

  if (this.status === 'returned') {
    let overdueDays = 0;
    if (this.returnDate && new Date(this.returnDate) > dueDate) {
      const diffMs = new Date(this.returnDate) - dueDate;
      overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }
    const finalFine = this.fine || (overdueDays > 0 ? overdueDays * FINE_PER_DAY : 0);
    return {
      status: 'returned',
      overdueDays: Math.max(0, overdueDays),
      fine: finalFine,
      finePaid: finalFine > 0 ? true : false,
      isOverdue: false,
      paymentPending: false
    };
  }

  // Active loan (issued or overdue)
  if (now > dueDate) {
    const diffMs = now - dueDate;
    const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    const calculatedFine = overdueDays * FINE_PER_DAY;
    const isPaid = !!this.finePaid;

    return {
      status: 'overdue',
      overdueDays,
      fine: isPaid && this.fine ? this.fine : calculatedFine,
      finePaid: isPaid,
      isOverdue: true,
      paymentPending: !isPaid && calculatedFine > 0
    };
  }

  return {
    status: this.status,
    overdueDays: 0,
    fine: 0,
    finePaid: false,
    isOverdue: false,
    paymentPending: false
  };
};

module.exports = mongoose.model('Loan', loanSchema);
