const express = require('express');
const router = express.Router();
const mediaController = require('../controllers/mediaController');
const multer = require('multer');

// Configure multer for memory storage (files will be forwarded to image backend, not saved locally)
const storage = multer.memoryStorage();

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

// Image backend upload route (for receiving files from data backend)
// This route should be enabled on the image backend server
if (process.env.ENABLE_IMAGE_BACKEND_UPLOAD === 'true') {
    try {
        const imageBackendMediaController = require('../controllers/imageBackendMediaController');
        router.post('/upload', imageBackendMediaController.upload.array('files'), imageBackendMediaController.handleImageBackendUpload);
    } catch (e) {
        console.warn('Image backend media controller not available:', e.message);
    }
}

// Route for handling media form submission (data backend)
router.post('/', upload.array('files'), mediaController.handleMediaForm);
router.get('/request', mediaController.getMedia);

module.exports = router;
