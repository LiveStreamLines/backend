const express = require('express');
const router = express.Router();
const canvasController = require('../controllers/studioController');
const authMiddleware = require('../controllers/authMiddleware');

// Use authentication middleware if necessary
router.use(authMiddleware);

const multer = require('multer');
const path = require('path');

// Configure multer for file storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = process.env.MEDIA_PATH + '/canvas_images';
        cb(null, uploadPath); // Specify the upload directory
    },
    filename: (req, file, cb) => {
        const uniqueName = `canvas_${Date.now()}${path.extname(file.originalname)}`;
        cb(null, uniqueName); // Generate a unique file name
    },
});

const upload = multer({ storage });


// Route for saving canvas image
router.post('/save', upload.single('image'), canvasController.saveCanvasImage);

module.exports = router;
