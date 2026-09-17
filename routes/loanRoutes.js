const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Librarian only: View all library loans
router.get('/', requireAuth, requireRole('librarian'), loanController.getAllLoans);

// Member only: View personal loans
router.get('/my', requireAuth, requireRole('member'), loanController.getMyLoans);

// Process return: Member can return their own book, Librarian can also process return
router.post('/:id/return', requireAuth, loanController.postReturnBook);

module.exports = router;
