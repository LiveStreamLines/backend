const express = require('express');
const router = express.Router();
const cameraPicsController = require('../controllers/cameraPicsController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);
// Define the route to get camera pictures by developer, project, and camera ID, with an optional date filter
router.post('/:developerId/:projectId/:cameraId/pictures/', cameraPicsController.getCameraPictures);
router.get('/preview/:developerId/:projectId/:cameraId/', cameraPicsController.getCameraPreview);

module.exports = router;