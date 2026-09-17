const Loan = require('../models/Loan');
const Book = require('../models/Book');
const Payment = require('../models/Payment');

// GET /loans/my - Member's personal loan history & active books
const getMyLoans = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const rawLoans = await Loan.find({ user: userId })
      .populate('book')
      .populate('payment')
      .sort({ issueDate: -1 });

    let activeCount = 0;
    let overdueCount = 0;
    let returnedCount = 0;
    let totalFine = 0;
    let outstandingFine = 0;
    let paidFines = 0;

    const loans = rawLoans.map((loan) => {
      const calc = loan.getCalculatedStatusAndFine();
      const enriched = loan.toObject();
      enriched.calculatedStatus = calc.status;
      enriched.overdueDays = calc.overdueDays;
      enriched.calculatedFine = calc.fine;
      enriched.isOverdue = calc.isOverdue;
      enriched.finePaid = calc.finePaid;
      enriched.paymentPending = calc.paymentPending;

      if (calc.status === 'returned') {
        returnedCount++;
        totalFine += enriched.fine || 0;
        paidFines += enriched.fine || 0;
      } else {
        activeCount++;
        if (calc.isOverdue) {
          overdueCount++;
          totalFine += calc.fine;
          if (calc.finePaid) {
            paidFines += calc.fine;
          } else {
            outstandingFine += calc.fine;
          }
        }
      }

      return enriched;
    });

    res.render('loans/myLoans', {
      title: 'My Borrowed Books - Library Management System',
      loans,
      stats: {
        activeCount,
        overdueCount,
        returnedCount,
        totalFine,
        outstandingFine,
        paidFines
      }
    });
  } catch (error) {
    next(error);
  }
};

// GET /loans - Librarian views all loans across library
const getAllLoans = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const filter = {};

    if (status && ['issued', 'returned', 'overdue'].includes(status)) {
      if (status === 'overdue') {
        filter.status = { $ne: 'returned' };
        filter.dueDate = { $lt: new Date() };
      } else if (status === 'issued') {
        filter.status = 'issued';
        filter.dueDate = { $gte: new Date() };
      } else {
        filter.status = status;
      }
    }

    const rawLoans = await Loan.find(filter)
      .populate('user')
      .populate('book')
      .populate('payment')
      .sort({ issueDate: -1 });

    let loans = rawLoans.map((loan) => {
      const calc = loan.getCalculatedStatusAndFine();
      const enriched = loan.toObject();
      enriched.calculatedStatus = calc.status;
      enriched.overdueDays = calc.overdueDays;
      enriched.calculatedFine = calc.fine;
      enriched.isOverdue = calc.isOverdue;
      enriched.finePaid = calc.finePaid;
      enriched.paymentPending = calc.paymentPending;
      return enriched;
    });

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      loans = loans.filter((l) => {
        const userName = l.user?.name?.toLowerCase() || '';
        const userEmail = l.user?.email?.toLowerCase() || '';
        const bookTitle = l.book?.title?.toLowerCase() || '';
        const bookIsbn = l.book?.isbn?.toLowerCase() || '';
        return (
          userName.includes(q) ||
          userEmail.includes(q) ||
          bookTitle.includes(q) ||
          bookIsbn.includes(q)
        );
      });
    }

    res.render('loans/allLoans', {
      title: 'All Loans Management - Librarian Admin',
      loans,
      selectedStatus: status || 'all',
      searchQuery: search || ''
    });
  } catch (error) {
    next(error);
  }
};

// GET /loans/:id/pay - Fine Payment Page (Member/Librarian)
const getPayFinePage = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id)
      .populate('book')
      .populate('user');

    if (!loan) {
      req.flash('error_msg', 'Loan record not found.');
      return res.redirect('/loans/my');
    }

    // Authorization check
    const isLibrarian = req.session.user.role === 'librarian';
    const isOwner = loan.user._id.toString() === req.session.user.id;
    if (!isLibrarian && !isOwner) {
      req.flash('error_msg', 'Unauthorized to access this loan payment.');
      return res.redirect('/dashboard');
    }

    if (loan.status === 'returned') {
      req.flash('error_msg', 'This book has already been returned.');
      return res.redirect('/loans/my');
    }

    const calc = loan.getCalculatedStatusAndFine();

    if (calc.fine === 0) {
      req.flash('success_msg', 'This book is not overdue. No fine payment is required.');
      return res.redirect('/loans/my');
    }

    if (loan.finePaid) {
      req.flash('success_msg', `The fine of ₹${loan.fine} for this book has already been paid. You can now return the book.`);
      return res.redirect('/loans/my');
    }

    res.render('loans/payFine', {
      title: 'Pay Library Fine - Library Management System',
      loan,
      book: loan.book,
      calc
    });
  } catch (error) {
    next(error);
  }
};

// POST /loans/:id/pay - Process Mock Fine Payment
const postPayFine = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id).populate('book');

    if (!loan) {
      req.flash('error_msg', 'Loan record not found.');
      return res.redirect('/loans/my');
    }

    // Authorization check
    const isLibrarian = req.session.user.role === 'librarian';
    const isOwner = loan.user.toString() === req.session.user.id;
    if (!isLibrarian && !isOwner) {
      req.flash('error_msg', 'Unauthorized to pay for this loan.');
      return res.redirect('/dashboard');
    }

    if (loan.status === 'returned') {
      req.flash('error_msg', 'This book has already been returned.');
      return res.redirect('/loans/my');
    }

    if (loan.finePaid) {
      req.flash('success_msg', `Fine already paid. You can proceed to return the book.`);
      return res.redirect('/loans/my');
    }

    const calc = loan.getCalculatedStatusAndFine();
    if (calc.fine <= 0) {
      req.flash('error_msg', 'No overdue fine exists for this book.');
      return res.redirect('/loans/my');
    }

    const { paymentMethod } = req.body;
    const allowedMethods = ['UPI', 'Card', 'Cash', 'Mock Payment'];
    const selectedMethod = allowedMethods.includes(paymentMethod) ? paymentMethod : 'UPI';

    // Generate unique transaction ID (e.g. LIB-A8F92K)
    const randomChars = Math.random().toString(36).substring(2, 8).toUpperCase();
    const timeCode = Date.now().toString().slice(-4);
    const transactionId = `LIB-${randomChars}${timeCode}`;

    // Create Payment record
    const payment = new Payment({
      user: loan.user,
      loan: loan._id,
      amount: calc.fine,
      paymentDate: new Date(),
      status: 'paid',
      paymentMethod: selectedMethod,
      transactionId
    });
    await payment.save();

    // Update Loan with fine amount and finePaid flag
    loan.fine = calc.fine;
    loan.finePaid = true;
    loan.payment = payment._id;
    await loan.save();

    req.flash(
      'success_msg',
      `Payment Successful! Transaction ID: ${transactionId} &bull; Amount: ₹${calc.fine}. You may now return the book.`
    );
    return res.redirect('/loans/my');
  } catch (error) {
    next(error);
  }
};

// POST /loans/:id/return - Return an issued book with strict fine enforcement
const postReturnBook = async (req, res, next) => {
  try {
    const loanId = req.params.id;
    const loan = await Loan.findById(loanId).populate('book');

    if (!loan) {
      req.flash('error_msg', 'Loan record not found.');
      return res.redirect('back');
    }

    // Permission check: either librarian or the member who owns the loan
    const isLibrarian = req.session.user.role === 'librarian';
    const isOwner = loan.user.toString() === req.session.user.id;

    if (!isLibrarian && !isOwner) {
      req.flash('error_msg', 'You are not authorized to return this book.');
      return res.redirect('/dashboard');
    }

    if (loan.status === 'returned') {
      req.flash('error_msg', 'This book has already been marked as returned.');
      return res.redirect('back');
    }

    // Dynamic overdue & fine check
    const calc = loan.getCalculatedStatusAndFine();

    // Strict return gate: If book is overdue and has an unpaid fine, BLOCK the return!
    if (calc.isOverdue && calc.fine > 0 && !loan.finePaid) {
      req.flash(
        'error_msg',
        `Please pay the outstanding fine of ₹${calc.fine} (${calc.overdueDays} days overdue) before returning this book.`
      );
      return res.redirect(`/loans/${loan._id}/pay`);
    }

    const returnDate = new Date();
    loan.returnDate = returnDate;
    loan.status = 'returned';

    // Preserve original fine if paid, or set final fine
    if (loan.finePaid) {
      // Keep loan.fine as the amount paid
      loan.fine = loan.fine || calc.fine;
    } else {
      loan.fine = 0;
      loan.finePaid = false;
    }

    await loan.save();

    // Safely increment availableCopies, never exceeding totalCopies
    if (loan.book) {
      await Book.findByIdAndUpdate(loan.book._id, [
        {
          $set: {
            availableCopies: {
              $min: [{ $add: ['$availableCopies', 1] }, '$totalCopies']
            }
          }
        }
      ]);
    }

    const bookTitle = loan.book ? loan.book.title : 'Book';
    if (loan.finePaid && loan.fine > 0) {
      req.flash(
        'success_msg',
        `"${bookTitle}" returned successfully. Fine of ₹${loan.fine} was paid.`
      );
    } else {
      req.flash('success_msg', `"${bookTitle}" returned successfully on time. No fine incurred.`);
    }

    if (isLibrarian && req.headers.referer && req.headers.referer.includes('/loans') && !req.headers.referer.includes('/loans/my')) {
      return res.redirect('/loans');
    }
    return res.redirect('/loans/my');
  } catch (error) {
    next(error);
  }
};

// GET /loans/payments - Librarian view for all payments
const getAllPayments = async (req, res, next) => {
  try {
    const { search } = req.query;
    const paymentsQuery = Payment.find()
      .populate('user', 'name email')
      .populate({
        path: 'loan',
        populate: { path: 'book', select: 'title author isbn coverImage' }
      })
      .sort({ paymentDate: -1 });

    const rawPayments = await paymentsQuery.exec();

    let payments = rawPayments;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      payments = payments.filter((p) => {
        const userName = p.user?.name?.toLowerCase() || '';
        const userEmail = p.user?.email?.toLowerCase() || '';
        const bookTitle = p.loan?.book?.title?.toLowerCase() || '';
        const bookIsbn = p.loan?.book?.isbn?.toLowerCase() || '';
        const txId = p.transactionId?.toLowerCase() || '';
        return (
          userName.includes(q) ||
          userEmail.includes(q) ||
          bookTitle.includes(q) ||
          bookIsbn.includes(q) ||
          txId.includes(q)
        );
      });
    }

    const totalCollected = payments.reduce((acc, curr) => acc + (curr.amount || 0), 0);

    res.render('loans/allPayments', {
      title: 'All Payments & Fine Collections - Librarian Admin',
      payments,
      searchQuery: search || '',
      stats: {
        totalCollected,
        totalPaymentsCount: payments.length
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyLoans,
  getAllLoans,
  getPayFinePage,
  postPayFine,
  postReturnBook,
  getAllPayments
};
