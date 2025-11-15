// routes/health.js
const express = require('express');
const router = express.Router();
const healthController = require('../controllers/healthController');

router.get('/', healthController.healthCheck);
router.get('/camera/:developerId/:projectId/:cameraId', healthController.cameraHealth);

module.exports = router;

