const express = require('express');
const router = express.Router();
const loanController = require('../controllers/loanController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Librarian only: View all library loans
router.get('/', requireAuth, requireRole('librarian'), loanController.getAllLoans);

// Librarian only: View all payments audit history
router.get('/payments', requireAuth, requireRole('librarian'), loanController.getAllPayments);

// Member only: View personal loans
router.get('/my', requireAuth, requireRole('member'), loanController.getMyLoans);

// Fine payment flow
router.get('/:id/pay', requireAuth, loanController.getPayFinePage);
router.post('/:id/pay', requireAuth, loanController.postPayFine);

// Process return with strict overdue fine check
router.post('/:id/return', requireAuth, loanController.postReturnBook);

module.exports = router;
