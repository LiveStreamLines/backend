const express = require('express');
const router = express.Router();
const getImageController = require('../controllers/getImageController');
const authMiddleware = require('../controllers/authMiddleware');

// Apply authentication middleware only to this route
router.use(authMiddleware.authMiddleware2);

// Route to get images by date range with authentication required
router.post('/:projectId/:cameraId/', getImageController.getImagesByDateRange);

module.exports = router;