const express = require('express');
const router = express.Router();
const bookController = require('../controllers/bookController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Public / Member catalogue
router.get('/', bookController.getAllBooks);

// Librarian only: Add book form & submission
router.get('/new', requireAuth, requireRole('librarian'), bookController.getNewBookForm);
router.post('/', requireAuth, requireRole('librarian'), bookController.postCreateBook);

// Book details
router.get('/:id', bookController.getBookDetails);

// Librarian only: Edit book form & submission
router.get('/:id/edit', requireAuth, requireRole('librarian'), bookController.getEditBookForm);
router.put('/:id', requireAuth, requireRole('librarian'), bookController.putUpdateBook);

// Librarian only: Delete book
router.delete('/:id', requireAuth, requireRole('librarian'), bookController.deleteBook);

// Member only: Issue book request
router.post('/:id/issue', requireAuth, requireRole('member'), bookController.postIssueBook);

module.exports = router;
