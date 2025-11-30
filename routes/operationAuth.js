// routes/operationAuth.js
const express = require('express');
const router = express.Router();
const operationAuthController = require('../controllers/operationAuthController');

router.post('/login', operationAuthController.login);
router.get('/email/:email', operationAuthController.getUserByEmail);
router.post('/reset-link', operationAuthController.sendResetPasswordLink);
router.post('/reset-password', operationAuthController.resetPassword);

// Test endpoints for force logout
router.post('/test/logout-user', operationAuthController.forceLogoutUser);
router.post('/test/remove-logout', operationAuthController.removeFromLogoutBlacklist);
router.get('/test/logout-blacklist', operationAuthController.getLogoutBlacklist);

module.exports = router;

