const express = require('express');
const router = express.Router();
const imageComparisonController = require('../controllers/imageComparisonController');
const authMiddleware = require('../controllers/authMiddleware');

// Apply authentication middleware
router.use(authMiddleware);

// Compare images by project, camera, and dates
router.post('/compare', imageComparisonController.compareImages);

// Compare images by direct paths (alternative endpoint)
router.post('/compare-by-path', imageComparisonController.compareImagesByPath);

module.exports = router;

