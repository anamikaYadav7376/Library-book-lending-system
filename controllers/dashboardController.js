const User = require('../models/User');
const Book = require('../models/Book');
const Loan = require('../models/Loan');

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
    .sort({ issueDate: -1 });

  let currentlyBorrowed = 0;
  let overdue = 0;
  let returned = 0;
  let totalFine = 0;

  const activeLoans = [];
  const borrowingHistory = [];

  rawLoans.forEach((loan) => {
    const calc = loan.getCalculatedStatusAndFine();
    const enriched = loan.toObject();
    enriched.calculatedStatus = calc.status;
    enriched.overdueDays = calc.overdueDays;
    enriched.calculatedFine = calc.fine;
    enriched.isOverdue = calc.isOverdue;

    if (calc.status === 'returned') {
      returned++;
      totalFine += enriched.fine || 0;
      borrowingHistory.push(enriched);
    } else {
      currentlyBorrowed++;
      if (calc.isOverdue) {
        overdue++;
        totalFine += calc.fine;
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
      totalFine
    },
    activeLoans,
    borrowingHistory: borrowingHistory.slice(0, 5) // Recent 5 history entries
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
    recentMembers
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
      .populate('book', 'title author')
      .sort({ issueDate: -1 })
      .limit(5),
    Loan.find({ status: 'returned' })
      .populate('user', 'name email')
      .populate('book', 'title author')
      .sort({ returnDate: -1 })
      .limit(5),
    User.find({ role: 'member' })
      .sort({ createdAt: -1 })
      .limit(5)
  ]);

  const totalCopies = bookCopiesAgg.length > 0 ? bookCopiesAgg[0].totalCopies : 0;
  const availableCopies = bookCopiesAgg.length > 0 ? bookCopiesAgg[0].availableCopies : 0;

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
    mostBorrowedTitles: mostBorrowedAgg,
    recentActivity: {
      recentIssues,
      recentReturns,
      recentMembers
    }
  });
}

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

    // For each member, retrieve active and overdue loans counts
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
  getMembersList
};
