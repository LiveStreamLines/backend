// routes/sync.js
const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

router.post('/trigger', syncController.triggerSync);

module.exports = router;

