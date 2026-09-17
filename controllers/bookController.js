const Book = require('../models/Book');
const Loan = require('../models/Loan');

// GET /books - Catalogue with search & category filtering
const getAllBooks = async (req, res, next) => {
  try {
    const { query, category } = req.query;
    const filter = {};

    if (category && category !== 'All') {
      filter.category = category;
    }

    if (query && query.trim()) {
      const searchRegex = new RegExp(query.trim(), 'i');
      filter.$or = [
        { title: searchRegex },
        { author: searchRegex },
        { isbn: searchRegex },
        { category: searchRegex }
      ];
    }

    const [books, categories] = await Promise.all([
      Book.find(filter).sort({ createdAt: -1 }),
      Book.distinct('category')
    ]);

    // If member is logged in, find their active loan book IDs
    let userActiveLoanBookIds = [];
    let memberActiveLoanCount = 0;
    if (req.session.user && req.session.user.role === 'member') {
      const activeLoans = await Loan.find({
        user: req.session.user.id,
        status: { $in: ['issued', 'overdue'] }
      }).select('book');
      userActiveLoanBookIds = activeLoans.map((loan) => loan.book.toString());
      memberActiveLoanCount = activeLoans.length;
    }

    res.render('books/index', {
      title: 'Book Catalogue - Library Management System',
      books,
      categories,
      selectedCategory: category || 'All',
      searchQuery: query || '',
      userActiveLoanBookIds,
      memberActiveLoanCount
    });
  } catch (error) {
    next(error);
  }
};

// GET /books/new - Form to add a new book (Librarian only)
const getNewBookForm = (req, res) => {
  res.render('books/create', {
    title: 'Add New Book - Librarian Admin',
    formData: {},
    errors: []
  });
};

// POST /books - Create new book (Librarian only)
const postCreateBook = async (req, res, next) => {
  const { title, author, isbn, category, description, totalCopies, coverImage } = req.body;
  const errors = [];

  if (!title || !title.trim()) errors.push('Book title is required');
  if (!author || !author.trim()) errors.push('Author is required');
  if (!isbn || !isbn.trim()) errors.push('ISBN is required');
  if (!category || !category.trim()) errors.push('Category is required');
  const parsedCopies = parseInt(totalCopies, 10);
  if (isNaN(parsedCopies) || parsedCopies <= 0) {
    errors.push('Total copies must be a positive integer greater than 0');
  }

  if (errors.length > 0) {
    return res.render('books/create', {
      title: 'Add New Book - Librarian Admin',
      formData: req.body,
      errors
    });
  }

  try {
    const existingBook = await Book.findOne({ isbn: isbn.trim().toUpperCase() });
    if (existingBook) {
      return res.render('books/create', {
        title: 'Add New Book - Librarian Admin',
        formData: req.body,
        errors: ['A book with this ISBN already exists in the catalogue']
      });
    }

    const book = new Book({
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim().toUpperCase(),
      category: category.trim(),
      description: description ? description.trim() : '',
      totalCopies: parsedCopies,
      availableCopies: parsedCopies, // Initially, all copies are available
      coverImage: coverImage && coverImage.trim() ? coverImage.trim() : undefined
    });

    await book.save();
    req.flash('success_msg', `Book "${book.title}" added to catalogue successfully.`);
    return res.redirect('/books');
  } catch (error) {
    next(error);
  }
};

// GET /books/:id - Details page
const getBookDetails = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      req.flash('error_msg', 'Book not found.');
      return res.redirect('/books');
    }

    let hasActiveLoan = false;
    let memberActiveLoanCount = 0;
    if (req.session.user && req.session.user.role === 'member') {
      const activeLoans = await Loan.find({
        user: req.session.user.id,
        status: { $in: ['issued', 'overdue'] }
      });
      memberActiveLoanCount = activeLoans.length;
      hasActiveLoan = activeLoans.some((l) => l.book.toString() === book._id.toString());
    }

    res.render('books/show', {
      title: `${book.title} - Book Details`,
      book,
      hasActiveLoan,
      memberActiveLoanCount
    });
  } catch (error) {
    next(error);
  }
};

// GET /books/:id/edit - Edit form (Librarian only)
const getEditBookForm = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      req.flash('error_msg', 'Book not found.');
      return res.redirect('/books');
    }

    res.render('books/edit', {
      title: `Edit ${book.title} - Librarian Admin`,
      book,
      formData: book,
      errors: []
    });
  } catch (error) {
    next(error);
  }
};

// PUT /books/:id - Update book (Librarian only)
const putUpdateBook = async (req, res, next) => {
  const { title, author, isbn, category, description, totalCopies, coverImage } = req.body;
  const errors = [];

  if (!title || !title.trim()) errors.push('Book title is required');
  if (!author || !author.trim()) errors.push('Author is required');
  if (!isbn || !isbn.trim()) errors.push('ISBN is required');
  if (!category || !category.trim()) errors.push('Category is required');
  const newTotal = parseInt(totalCopies, 10);
  if (isNaN(newTotal) || newTotal <= 0) {
    errors.push('Total copies must be a positive integer');
  }

  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      req.flash('error_msg', 'Book not found.');
      return res.redirect('/books');
    }

    if (errors.length > 0) {
      return res.render('books/edit', {
        title: `Edit ${book.title} - Librarian Admin`,
        book,
        formData: req.body,
        errors
      });
    }

    // Check ISBN uniqueness if changed
    if (isbn.trim().toUpperCase() !== book.isbn) {
      const duplicate = await Book.findOne({
        isbn: isbn.trim().toUpperCase(),
        _id: { $ne: book._id }
      });
      if (duplicate) {
        return res.render('books/edit', {
          title: `Edit ${book.title} - Librarian Admin`,
          book,
          formData: req.body,
          errors: ['Another book with this ISBN already exists']
        });
      }
    }

    // Safely update availableCopies when totalCopies changes
    // Currently issued copies:
    const issuedCopies = book.totalCopies - book.availableCopies;
    if (newTotal < issuedCopies) {
      return res.render('books/edit', {
        title: `Edit ${book.title} - Librarian Admin`,
        book,
        formData: req.body,
        errors: [`Cannot reduce total copies below ${issuedCopies} because ${issuedCopies} copies are currently on active loan.`]
      });
    }

    const newAvailable = newTotal - issuedCopies;

    book.title = title.trim();
    book.author = author.trim();
    book.isbn = isbn.trim().toUpperCase();
    book.category = category.trim();
    book.description = description ? description.trim() : '';
    book.totalCopies = newTotal;
    book.availableCopies = Math.max(0, Math.min(newAvailable, newTotal));
    if (coverImage && coverImage.trim()) {
      book.coverImage = coverImage.trim();
    }

    await book.save();
    req.flash('success_msg', `Book "${book.title}" updated successfully.`);
    return res.redirect(`/books/${book._id}`);
  } catch (error) {
    next(error);
  }
};

// DELETE /books/:id - Delete book (Librarian only)
const deleteBook = async (req, res, next) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      req.flash('error_msg', 'Book not found.');
      return res.redirect('/books');
    }

    // Check if active loans exist for this book
    const activeLoan = await Loan.findOne({
      book: book._id,
      status: { $in: ['issued', 'overdue'] }
    });

    if (activeLoan) {
      req.flash('error_msg', `Cannot delete "${book.title}" because there are copies currently on loan.`);
      return res.redirect(`/books/${book._id}`);
    }

    await Book.findByIdAndDelete(book._id);
    req.flash('success_msg', `Book "${book.title}" was deleted successfully.`);
    return res.redirect('/books');
  } catch (error) {
    next(error);
  }
};

// POST /books/:id/issue - Issue/Request a book (Member only)
const postIssueBook = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const bookId = req.params.id;

    // Check member active loans count (limit = 5)
    const activeLoans = await Loan.find({
      user: userId,
      status: { $in: ['issued', 'overdue'] }
    });

    if (activeLoans.length >= 5) {
      req.flash('error_msg', 'You have reached your maximum borrowing limit of 5 books.');
      return res.redirect(`/books/${bookId}`);
    }

    // Check if user already has an active loan for this exact book
    const alreadyBorrowed = activeLoans.some((l) => l.book.toString() === bookId);
    if (alreadyBorrowed) {
      req.flash('error_msg', 'You already have an active loan for this book.');
      return res.redirect(`/books/${bookId}`);
    }

    // Atomically find book and decrement availableCopies if > 0
    const book = await Book.findOneAndUpdate(
      { _id: bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true }
    );

    if (!book) {
      const bookExists = await Book.findById(bookId);
      if (!bookExists) {
        req.flash('error_msg', 'The requested book does not exist.');
        return res.redirect('/books');
      }
      req.flash('error_msg', 'This book is currently unavailable.');
      return res.redirect(`/books/${bookId}`);
    }

    // Create loan record (14 days borrowing period)
    const issueDate = new Date();
    const dueDate = new Date(issueDate.getTime() + 14 * 24 * 60 * 60 * 1000);

    const loan = new Loan({
      user: userId,
      book: book._id,
      issueDate,
      dueDate,
      status: 'issued',
      fine: 0
    });

    await loan.save();

    req.flash('success_msg', `Successfully issued "${book.title}". Due date: ${dueDate.toLocaleDateString('en-GB')}.`);
    return res.redirect('/loans/my');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllBooks,
  getNewBookForm,
  postCreateBook,
  getBookDetails,
  getEditBookForm,
  putUpdateBook,
  deleteBook,
  postIssueBook
};
