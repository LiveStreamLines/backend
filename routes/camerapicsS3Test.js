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

module.exports = router;

