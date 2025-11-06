// routes/auth.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.get('/email/:email', authController.getUserByEmail);
router.post('/reset-link', authController.sendResetPasswordLink);
router.post('/reset-password', authController.resetPassword);

// Test endpoints for force logout
router.post('/test/logout-user', authController.forceLogoutUser);
router.post('/test/remove-logout', authController.removeFromLogoutBlacklist);
router.get('/test/logout-blacklist', authController.getLogoutBlacklist);

module.exports = router;
