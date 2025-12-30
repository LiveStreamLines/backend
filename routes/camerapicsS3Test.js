const express = require('express');
const router = express.Router();
const cameraPicsControllerS3Test = require('../controllers/cameraPicsControllerS3Test');
const authMiddleware = require('../controllers/authMiddleware');

// Test routes for S3-based camera pictures controller
// These routes mirror the original routes but use S3 storage

router.get('/emaar/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getEmaarPics);
router.use(authMiddleware);
// Define the route to get camera pictures by developer, project, and camera ID, with an optional date filter
router.post('/:developerId/:projectId/:cameraId/pictures/', cameraPicsControllerS3Test.getCameraPictures);
router.get('/preview/:developerId/:projectId/:cameraId/', cameraPicsControllerS3Test.getCameraPreview);
router.get('/preview-video/:developerId/:projectId/:cameraId/', cameraPicsControllerS3Test.generateWeeklyVideo);
// Route to get presigned URL for an image
router.get('/image/:developerId/:projectId/:cameraId/:imageTimestamp', cameraPicsControllerS3Test.getImagePresignedUrl);
// Slideshow routes
router.get('/slideshow/30days/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getSlideshow30Days);
router.get('/slideshow/quarter/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getSlideshowQuarter);
router.get('/slideshow/6months/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getSlideshow6Months);
router.get('/slideshow/1year/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getSlideshow1Year);

module.exports = router;

