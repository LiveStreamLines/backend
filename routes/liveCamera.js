const express = require('express');
const router = express.Router();
const liveCameraController = require('../controllers/liveCameraController');
//const authMiddleware = require('../controllers/authMiddleware');

// Protect all routes
//router.use(authMiddleware);

// Routes for live cameras
router.get('/', liveCameraController.getAllLiveCameras);
router.get('/:id', liveCameraController.getLiveCameraById);
router.post('/', liveCameraController.addLiveCamera);
router.put('/:id', liveCameraController.updateLiveCamera);
router.delete('/:id', liveCameraController.deleteLiveCamera);

module.exports = router;

