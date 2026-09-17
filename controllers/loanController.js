const Loan = require('../models/Loan');
const Book = require('../models/Book');

// GET /loans/my - Member's personal loan history & active books
const getMyLoans = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const rawLoans = await Loan.find({ user: userId })
      .populate('book')
      .sort({ issueDate: -1 });

    let activeCount = 0;
    let overdueCount = 0;
    let returnedCount = 0;
    let totalFine = 0;

    const loans = rawLoans.map((loan) => {
      const calc = loan.getCalculatedStatusAndFine();
      const enriched = loan.toObject();
      enriched.calculatedStatus = calc.status;
      enriched.overdueDays = calc.overdueDays;
      enriched.calculatedFine = calc.fine;
      enriched.isOverdue = calc.isOverdue;

      if (calc.status === 'returned') {
        returnedCount++;
        totalFine += enriched.fine || 0;
      } else {
        activeCount++;
        if (calc.isOverdue) {
          overdueCount++;
          totalFine += calc.fine;
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
        totalFine
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
        // Active loans past due date
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
      .sort({ issueDate: -1 });

    let loans = rawLoans.map((loan) => {
      const calc = loan.getCalculatedStatusAndFine();
      const enriched = loan.toObject();
      enriched.calculatedStatus = calc.status;
      enriched.overdueDays = calc.overdueDays;
      enriched.calculatedFine = calc.fine;
      enriched.isOverdue = calc.isOverdue;
      return enriched;
    });

    // Optional filter by search query (member name, email, or book title)
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

// POST /loans/:id/return - Return an issued book
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

    const returnDate = new Date();
    loan.returnDate = returnDate;
    loan.status = 'returned';

    // Calculate fine if returned late
    const dueDate = new Date(loan.dueDate);
    let finalFine = 0;
    let overdueDays = 0;

    if (returnDate > dueDate) {
      const diffMs = returnDate - dueDate;
      overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      finalFine = Math.max(0, overdueDays * 5); // ₹5 per day
    }

    loan.fine = finalFine;
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
    if (finalFine > 0) {
      req.flash(
        'success_msg',
        `"${bookTitle}" returned successfully. Overdue by ${overdueDays} day(s). Late fine: ₹${finalFine}.`
      );
    } else {
      req.flash('success_msg', `"${bookTitle}" returned successfully on time. No fine incurred.`);
    }

    if (isLibrarian && req.headers.referer && req.headers.referer.includes('/loans')) {
      return res.redirect('/loans');
    }
    return res.redirect('/loans/my');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyLoans,
  getAllLoans,
  postReturnBook
};
