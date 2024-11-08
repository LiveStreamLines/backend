// routes/video.js
const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

// Define route to generate a video from selected pictures
router.post('/', videoController.generateVideo);

module.exports = router;
