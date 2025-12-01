const express = require('express');
const router = express.Router();
const attachmentController = require('../controllers/attachmentController');
const authMiddleware = require('../controllers/authMiddleware');

// Apply authentication middleware
router.use(authMiddleware);

// Get presigned URL for an attachment
router.post('/presigned-url', attachmentController.getPresignedUrl);

module.exports = router;

