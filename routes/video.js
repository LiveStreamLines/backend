// routes/video.js
const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

const multer = require('multer');
const upload = multer({ dest: process.env.MEDIA_PATH + '/upload/' }); // You can customize the destination folder


// Define route to generate a video from selected pictures
//router.post('/', videoController.generateVideo);
router.post('/filter', upload.single('logo') ,videoController.filterPics);
router.get('/request',videoController.getAllVideoRequest);

module.exports = router;
