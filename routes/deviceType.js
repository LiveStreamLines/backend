const express = require('express');
const router = express.Router();
const deviceTypeController = require('../controllers/deviceTypeController');
//const authMiddleware = require('../controllers/authMiddleware');

// Protect all routes
//router.use(authMiddleware);

// Routes matching the project pattern
router.get('/', deviceTypeController.getDeviceType);
router.post('/', deviceTypeController.addDeviceType);
router.get('/:id', deviceTypeController.getDeviceTypebyId);
router.put('/:id', deviceTypeController.updatedDeviceType);

module.exports = router;