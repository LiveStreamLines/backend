const express = require('express');
const router = express.Router();
const imageBackendMediaController = require('../controllers/imageBackendMediaController');

// Route for handling file uploads on image backend
// This route should be added to the image backend server
router.post('/upload', imageBackendMediaController.upload.array('files'), imageBackendMediaController.handleImageBackendUpload);

module.exports = router;

