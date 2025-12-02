// routes/cameras.js
const express = require('express');
const router = express.Router();
const cameraController = require('../controllers/cameraController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

const multer = require('multer');
const path = require('path');
const fs = require('fs');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Configure multer for internal attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'internalAttachments') {
      const tempDir = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../media'), 'attachments/cameras/temp');
      ensureDir(tempDir);
      cb(null, tempDir);
      return;
    }
    const fallbackDir = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../media'), 'uploads/tmp');
    ensureDir(fallbackDir);
    cb(null, fallbackDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

// Configure multer for attachment uploads
const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const cameraId = req.params.cameraId;
        const uploadPath = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../media'), 'attachments/cameras', cameraId);
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${name}_${timestamp}${ext}`);
    }
});

const upload = multer({ storage });
const uploadFields = upload.fields([
  { name: 'internalAttachments', maxCount: 10 },
]);
const attachmentUpload = multer({ 
    storage: attachmentStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

router.get('/', cameraController.getAllCameras);
router.get('/pics/last', cameraController.getLastPicturesFromAllCameras);
router.get('/maintenance-cycle/start-date', cameraController.getMaintenanceCycleStartDate);
router.get('/:id', cameraController.getCameraById);
router.get('/proj/:id', cameraController.getCameraByProject);   
router.get('/projtag/:tag', cameraController.getCameraByProjectTag);
router.get('/dev/:id', cameraController.getCameraByDeveloperId);
router.post('/', uploadFields, cameraController.addCamera);
router.put('/:id', uploadFields, cameraController.updateCamera);
router.put('/:id/maintenance-status', cameraController.updateCameraMaintenanceStatus);
router.put('/:id/install', cameraController.updateCameraInstallationDate);
router.put('/:id/invoice', cameraController.updateCameraInvoiceInfo);
router.put('/:id/invoiced-duration', cameraController.updateCameraInvoicedDuration);
router.delete('/:id', cameraController.deleteCamera);

// Attachment routes (matching developer pattern - deletes from internalAttachments)
router.delete('/:id/attachments/:attachmentId', cameraController.deleteAttachment);

// Legacy routes for regular attachments (if still needed)
router.post('/:cameraId/attachments', attachmentUpload.single('file'), cameraController.uploadCameraAttachment);
router.get('/:cameraId/attachments', cameraController.getCameraAttachments);
router.delete('/:cameraId/attachments/:attachmentId', cameraController.deleteCameraAttachment);

// Internal attachment routes
router.delete('/:id/internal-attachments/:attachmentId', cameraController.deleteInternalAttachment);

module.exports = router;
