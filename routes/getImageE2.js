const express = require('express');
const router = express.Router();
const getImageControllerE2 = require('../controllers/getImageControllerE2');
const authMiddleware = require('../controllers/authMiddleware');

// Apply authentication middleware
router.use(authMiddleware);

// Route to get images by date range from iDrive E2 bucket (test endpoint)
// This is a copy of the original get-image endpoint but uses iDrive E2 bucket
router.post('/:projectId/:cameraId/', getImageControllerE2.getImagesByDateRange);

// Route to delete a specific image by timestamp from iDrive E2 bucket (test endpoint)
router.delete('/:developerId/:projectId/:cameraId/:imageTimestamp', getImageControllerE2.deleteImage);

module.exports = router;

