const express = require('express');
const router = express.Router();
const canvasController = require('../controllers/studioController');
const authMiddleware = require('../controllers/authMiddleware');

// Use authentication middleware if necessary
router.use(authMiddleware);

// Route for saving canvas image
router.post('/save', canvasController.saveCanvasImage);

module.exports = router;
