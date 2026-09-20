const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireGuest } = require('../middleware/authMiddleware');

// 1. Unified Sign In / Role Selection Landing Page
router.get('/signin', requireGuest, authController.getSignIn);

// 2. Registration (Requires ?role=student or ?role=staff)
router.get('/register', requireGuest, authController.getRegister);
router.post('/register', requireGuest, authController.postRegister);

// 3. Login
router.get('/login', requireGuest, authController.getLogin);
router.post('/login', requireGuest, authController.postLogin);

// 4. Logout
router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

module.exports = router;