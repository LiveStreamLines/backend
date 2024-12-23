// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.get('/email/:email', authController.getUserByEmail);
router.post('/reset-password', authController.resetPassword);

module.exports = router;
