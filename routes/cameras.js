// routes/cameras.js
const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/cameraController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

router.get('/', cameraController.getAllCameras);
router.get('/pics/last', cameraController.getLastPicturesFromAllCameras);
router.get('/:id', cameraController.getCameraById);
router.get('/proj/:id', cameraController.getCameraByProject);   
router.get('/projtag/:tag', cameraController.getCameraByProjectTag);
router.get('/dev/:id', cameraController.getCameraByDeveloperId);
router.post('/', cameraController.addCamera);
router.put('/:id', cameraController.updateCamera);
router.put('/:id/install', cameraController.updateCameraInstallationDate);
router.put('/:id/invoice', cameraController.updateCameraInvoiceInfo);
router.put('/:id/invoiced-duration', cameraController.updateCameraInvoicedDuration);
router.delete('/:id', cameraController.deleteCamera);

module.exports = router;
