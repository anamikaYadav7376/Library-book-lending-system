const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

// Home route redirect
router.get('/', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/dashboard');
  }
  return res.redirect('/books');
});

// Dashboard route (role-aware)
router.get('/dashboard', requireAuth, dashboardController.getDashboard);

// Members directory (Librarian only)
router.get('/members', requireAuth, requireRole('librarian'), dashboardController.getMembersList);

module.exports = router;
