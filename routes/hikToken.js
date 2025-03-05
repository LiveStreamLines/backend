// routes/cameras.js
const express = require('express');
const router = express.Router();
const hikTokenController = require('../controllers/hikTokenController');
const authMiddleware = require('../controllers/authMiddleware');

//router.use(authMiddleware);

router.get('/all', hikTokenController.getTokens);
router.post('/save', hikTokenController.addToken);

module.exports = router;
