const express = require('express');
const router = express.Router();
const authMiddleware = require('../controllers/authMiddleware');
const cameraStatusHistoryController = require('../controllers/cameraStatusHistoryController');

router.use(authMiddleware);

router.get('/', cameraStatusHistoryController.getAllHistory);
router.get('/:cameraId', cameraStatusHistoryController.getHistoryByCamera);

module.exports = router;

