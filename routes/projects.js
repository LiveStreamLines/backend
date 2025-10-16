// routes/projects.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file upload (project logos)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.env.MEDIA_PATH + '/logos/project'); // Directory for project images
    },
    filename: (req, file, cb) => {
        const projectId = req.params.id || req.body.id; // Use id from params if updating, or from body if adding
        const ext = path.extname(file.originalname);     // Preserve file extension
        cb(null, `${projectId}${ext}`);                 // Rename file as projectId.ext
    }
});

// Configure multer for attachment uploads
const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const projectId = req.params.projectId;
        const uploadPath = path.join(process.env.MEDIA_PATH, 'attachments/projects', projectId);
        
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
const attachmentUpload = multer({ 
    storage: attachmentStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

router.get('/', projectController.getAllProjects);
router.get('/available-for-sales-order/:developerId', projectController.getAvailableProjectsForSalesOrder);
router.get('/dev/:id', projectController.getProjectByDeveloper);
router.get('/devTag/:tag', projectController.getProjectByDeveloperTag);
router.get('/tag/:tag', projectController.getProjectByTag);
router.get('/:id', projectController.getProjectById);
router.post('/', upload.single('logo'),projectController.addProject);
router.put('/:id', upload.single('logo'), projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// Attachment routes
router.post('/:projectId/attachments', attachmentUpload.single('file'), projectController.uploadProjectAttachment);
router.get('/:projectId/attachments', projectController.getProjectAttachments);
router.delete('/:projectId/attachments/:attachmentId', projectController.deleteProjectAttachment);

module.exports = router;
