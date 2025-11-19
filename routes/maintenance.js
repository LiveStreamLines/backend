const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenanceController');
const authMiddleware = require('../controllers/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Configure multer for attachment uploads (multiple files allowed)
const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // For new tasks, we'll use a temp ID and move files after task creation
        // For now, use a temp directory
        const uploadPath = path.join(process.env.MEDIA_PATH, 'attachments/maintenance', 'temp');
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, `${name}_${timestamp}_${random}${ext}`);
    }
});

const attachmentUpload = multer({ 
    storage: attachmentStorage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit per file
        files: 10 // Maximum 10 files
    }
});

// Get all maintenance requests
router.get('/', maintenanceController.getAllMaintenance);

// Get maintenance request by ID
router.get('/:id', maintenanceController.getMaintenanceById);

// Create new maintenance request (with optional file attachments)
router.post('/', attachmentUpload.array('attachments', 10), maintenanceController.createMaintenance);

// Update maintenance request (with optional file attachments)
router.put('/:id', attachmentUpload.array('attachments', 10), maintenanceController.updateMaintenance);

// Delete maintenance request
router.delete('/:id', maintenanceController.deleteMaintenance);

// Get maintenance requests by camera ID
router.get('/camera/:cameraId', maintenanceController.getMaintenanceByCamera);

// Get maintenance requests by assigned user
router.get('/user/:userId', maintenanceController.getMaintenanceByUser);

module.exports = router;