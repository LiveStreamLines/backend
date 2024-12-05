// routes/video.js
const express = require('express');
const router = express.Router();
const videoController = require('../controllers/videoController');

const multer = require('multer');
const upload = multer({ dest: process.env.MEDIA_PATH + '/upload/' }); // You can customize the destination folder


// Define route to generate a video from selected pictures
//router.post('/', videoController.generateVideo);
router.post('/videoGen', upload.fields([
    { name: 'logo', maxCount: 1 }, // Expecting one file for logo
    { name: 'showedWatermark', maxCount: 1 } // Expecting one file for watermark
  ]) ,videoController.generateVideoRequest);
router.post('/photoGen', videoController.generatePhotoRequest);
router.get('/videoRequest',videoController.getAllVideoRequest);
router.get('/photoRequest',videoController.getAllPhotoRequest);


module.exports = router;
