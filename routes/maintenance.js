const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');

// Get all maintenance requests
router.get('/', maintenanceController.getAllMaintenance);

// Get maintenance request by ID
router.get('/:id', maintenanceController.getMaintenanceById);

// Create new maintenance request
router.post('/', maintenanceController.createMaintenance);

// Update maintenance request
router.put('/:id', maintenanceController.updateMaintenance);

// Delete maintenance request
router.delete('/:id', maintenanceController.deleteMaintenance);

// Get maintenance requests by camera ID
router.get('/camera/:cameraId', maintenanceController.getMaintenanceByCamera);

// Get maintenance requests by assigned user
router.get('/user/:userId', maintenanceController.getMaintenanceByUser);

module.exports = router;