const express = require('express');
const router = express.Router();
const getImageController = require('../controllers/getImageController');
const authMiddleware = require('../controllers/authMiddleware');

// Apply authentication middleware only to this route
router.use(authMiddleware);

// Route to get images by date range with authentication required
router.post('/:projectId/:cameraId/', getImageController.getImagesByDateRange);

// Route to delete a specific image by timestamp with authentication required
router.delete('/:developerId/:projectId/:cameraId/:imageTimestamp', getImageController.deleteImage);

module.exports = router;