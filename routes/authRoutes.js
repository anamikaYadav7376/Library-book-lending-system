const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireGuest } = require('../middleware/authMiddleware');

router.get('/register', requireGuest, authController.getRegister);
router.post('/register', requireGuest, authController.postRegister);

router.get('/login', requireGuest, authController.getLogin);
router.post('/login', requireGuest, authController.postLogin);

router.get('/logout', authController.logout);
router.post('/logout', authController.logout);

module.exports = router;
