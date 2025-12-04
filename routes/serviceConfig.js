const express = require('express');
const router = express.Router();
const serviceConfigController = require('../controllers/serviceConfigController');
//const authMiddleware = require('../controllers/authMiddleware');

// Protect all routes
//router.use(authMiddleware);

// Routes for service configuration
router.get('/', serviceConfigController.getServiceConfig);
router.put('/', serviceConfigController.updateServiceConfig);

module.exports = router;

