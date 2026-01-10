const express = require('express');
const router = express.Router();
const cameraPicsControllerS3Test = require('../controllers/cameraPicsControllerS3Test');
const authMiddleware = require('../controllers/authMiddleware');

// Test routes for S3-based camera pictures controller
// These routes mirror the original routes but use S3 storage

router.get('/emaar/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getEmaarPics);
// Route to proxy image with CORS headers (no auth required for images - place before authMiddleware)
router.get('/proxy/:developerId/:projectId/:cameraId/:imageTimestamp', cameraPicsControllerS3Test.proxyImage);
// Handle OPTIONS preflight for proxy endpoint
router.options('/proxy/:developerId/:projectId/:cameraId/:imageTimestamp', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.status(204).send();
});
router.use(authMiddleware);
// Define the route to get camera pictures by developer, project, and camera ID, with an optional date filter
router.post('/:developerId/:projectId/:cameraId/pictures/', cameraPicsControllerS3Test.getCameraPictures);
// New optimized endpoint to get all available dates for a camera
router.get('/:developerId/:projectId/:cameraId/available-dates', cameraPicsControllerS3Test.getAvailableDates);
router.get('/preview/:developerId/:projectId/:cameraId/', cameraPicsControllerS3Test.getCameraPreview);
router.get('/preview-video/:developerId/:projectId/:cameraId/', cameraPicsControllerS3Test.generateWeeklyVideo);
// Route to get presigned URL for an image
router.get('/image/:developerId/:projectId/:cameraId/:imageTimestamp', cameraPicsControllerS3Test.getImagePresignedUrl);
// Route to get presigned URL for a thumbnail
router.get('/thumbnail/:developerId/:projectId/:cameraId/:imageTimestamp', cameraPicsControllerS3Test.getThumbnailPresignedUrl);
// Slideshow routes
router.get('/slideshow/30days/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getSlideshow30Days);
router.get('/slideshow/quarter/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getSlideshowQuarter);
router.get('/slideshow/6months/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getSlideshow6Months);
router.get('/slideshow/1year/:developerId/:projectId/:cameraId', cameraPicsControllerS3Test.getSlideshow1Year);

module.exports = router;

