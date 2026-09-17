const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');
const Payment = require('../models/Payment');

// GET /dashboard
const getDashboard = async (req, res, next) => {
  try {
    const userRole = req.session.user.role;

    if (userRole === 'member') {
      return await renderMemberDashboard(req, res);
    } else {
      return await renderLibrarianDashboard(req, res);
    }
  } catch (error) {
    next(error);
  }
};

// Member Dashboard Logic
async function renderMemberDashboard(req, res) {
  const userId = req.session.user.id;
  const rawLoans = await Loan.find({ user: userId })
    .populate('book')
    .populate('payment')
    .sort({ issueDate: -1 });

  let currentlyBorrowed = 0;
  let overdue = 0;
  let returned = 0;
  let totalFine = 0;
  let outstandingFine = 0;
  let paidFines = 0;

  const activeLoans = [];
  const borrowingHistory = [];

  rawLoans.forEach((loan) => {
    const calc = loan.getCalculatedStatusAndFine();
    const enriched = loan.toObject();
    enriched.calculatedStatus = calc.status;
    enriched.overdueDays = calc.overdueDays;
    enriched.calculatedFine = calc.fine;
    enriched.isOverdue = calc.isOverdue;
    enriched.finePaid = calc.finePaid;
    enriched.paymentPending = calc.paymentPending;

    if (calc.status === 'returned') {
      returned++;
      totalFine += enriched.fine || 0;
      paidFines += enriched.fine || 0;
      borrowingHistory.push(enriched);
    } else {
      currentlyBorrowed++;
      if (calc.isOverdue) {
        overdue++;
        totalFine += calc.fine;
        if (calc.finePaid) {
          paidFines += calc.fine;
        } else {
          outstandingFine += calc.fine;
        }
      }
      activeLoans.push(enriched);
    }
  });

  res.render('dashboard/memberDashboard', {
    title: 'Member Dashboard - Library Management System',
    user: req.session.user,
    stats: {
      currentlyBorrowed,
      overdue,
      returned,
      totalFine,
      outstandingFine,
      paidFines
    },
    activeLoans,
    borrowingHistory: borrowingHistory.slice(0, 5)
  });
}

// Librarian Dashboard Logic
async function renderLibrarianDashboard(req, res) {
  const now = new Date();

  // Dynamic MongoDB calculations
  const [
    totalBooks,
    totalMembers,
    bookCopiesAgg,
    issuedBooks,
    overdueBooks,
    mostBorrowedAgg,
    recentIssues,
    recentReturns,
    recentMembers,
    paymentsCollectedAgg,
    totalPaidCount,
    activeOverdueLoans
  ] = await Promise.all([
    Book.countDocuments(),
    User.countDocuments({ role: 'member' }),
    Book.aggregate([
      {
        $group: {
          _id: null,
          totalCopies: { $sum: '$totalCopies' },
          availableCopies: { $sum: '$availableCopies' }
        }
      }
    ]),
    Loan.countDocuments({ status: { $ne: 'returned' } }),
    Loan.countDocuments({
      status: { $ne: 'returned' },
      dueDate: { $lt: now }
    }),
    Loan.aggregate([
      { $group: { _id: '$book', loanCount: { $sum: 1 } } },
      { $sort: { loanCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: 'books',
          localField: '_id',
          foreignField: '_id',
          as: 'bookDetails'
        }
      },
      { $unwind: '$bookDetails' }
    ]),
    Loan.find({ status: { $ne: 'returned' } })
      .populate('user', 'name email')
      .populate('book', 'title author coverImage')
      .sort({ issueDate: -1 })
      .limit(5),
    Loan.find({ status: 'returned' })
      .populate('user', 'name email')
      .populate('book', 'title author coverImage')
      .sort({ returnDate: -1 })
      .limit(5),
    User.find({ role: 'member' })
      .sort({ createdAt: -1 })
      .limit(5),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
    ]),
    Payment.countDocuments({ status: 'paid' }),
    Loan.find({
      status: { $ne: 'returned' },
      dueDate: { $lt: now }
    })
  ]);

  const totalCopies = bookCopiesAgg.length > 0 ? bookCopiesAgg[0].totalCopies : 0;
  const availableCopies = bookCopiesAgg.length > 0 ? bookCopiesAgg[0].availableCopies : 0;

  // Calculate dynamic fine statistics
  const totalFinesCollected = paymentsCollectedAgg.length > 0 ? paymentsCollectedAgg[0].totalAmount : 0;

  let totalOutstandingFines = 0;
  let unpaidFinesCount = 0;
  activeOverdueLoans.forEach((loan) => {
    if (!loan.finePaid) {
      unpaidFinesCount++;
      const diffMs = now - new Date(loan.dueDate);
      const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      totalOutstandingFines += Math.max(0, overdueDays * 5);
    }
  });

  res.render('dashboard/librarianDashboard', {
    title: 'Librarian Admin Dashboard - Library Management System',
    user: req.session.user,
    stats: {
      totalBooks,
      totalCopies,
      availableCopies,
      issuedBooks,
      overdueBooks,
      totalMembers
    },
    fineStats: {
      totalOutstandingFines,
      totalFinesCollected,
      paidFinesCount: totalPaidCount,
      unpaidFinesCount
    },
    mostBorrowedTitles: mostBorrowedAgg,
    recentActivity: {
      recentIssues,
      recentReturns,
      recentMembers
    }
  });
}

// GET /account - Member Account & Payment History
const getAccountPage = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId);

    if (!user) {
      req.flash('error_msg', 'User not found.');
      return res.redirect('/dashboard');
    }

    const [loans, payments] = await Promise.all([
      Loan.find({ user: userId }).populate('book'),
      Payment.find({ user: userId })
        .populate({
          path: 'loan',
          populate: { path: 'book', select: 'title author isbn coverImage' }
        })
        .sort({ paymentDate: -1 })
    ]);

    let currentlyBorrowed = 0;
    let overdueCount = 0;
    let outstandingFines = 0;
    const now = new Date();

    loans.forEach((loan) => {
      if (loan.status !== 'returned') {
        currentlyBorrowed++;
        if (new Date(loan.dueDate) < now) {
          overdueCount++;
          if (!loan.finePaid) {
            const diffMs = now - new Date(loan.dueDate);
            const overdueDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
            outstandingFines += Math.max(0, overdueDays * 5);
          }
        }
      }
    });

    const paidFines = payments
      .filter((p) => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount || 0), 0);

    const totalFines = paidFines + outstandingFines;

    res.render('dashboard/account', {
      title: 'My Account & Payment History - Library Management System',
      user,
      borrowingStats: {
        currentlyBorrowed,
        overdueCount
      },
      fineSummary: {
        totalFines,
        paidFines,
        outstandingFines
      },
      payments
    });
  } catch (error) {
    next(error);
  }
};

// GET /members - Librarian Member Management
const getMembersList = async (req, res, next) => {
  try {
    const { search } = req.query;
    const filter = { role: 'member' };

    if (search && search.trim()) {
      const q = new RegExp(search.trim(), 'i');
      filter.$or = [{ name: q }, { email: q }];
    }

    const members = await User.find(filter).sort({ createdAt: -1 });

    const membersWithLoanCounts = await Promise.all(
      members.map(async (member) => {
        const activeLoans = await Loan.find({
          user: member._id,
          status: { $ne: 'returned' }
        });

        const overdueCount = activeLoans.filter(
          (loan) => new Date() > new Date(loan.dueDate)
        ).length;

        return {
          _id: member._id,
          name: member.name,
          email: member.email,
          role: member.role,
          createdAt: member.createdAt,
          activeLoansCount: activeLoans.length,
          overdueLoansCount: overdueCount
        };
      })
    );

    res.render('dashboard/members', {
      title: 'Member Management - Librarian Admin',
      members: membersWithLoanCounts,
      searchQuery: search || ''
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboard,
  getAccountPage,
  getMembersList
};
