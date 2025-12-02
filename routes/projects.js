// routes/projects.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
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

// Configure multer for logo and internal attachments
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.fieldname === 'logo') {
      const logoDir = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../media'), 'logos/project');
      ensureDir(logoDir);
      cb(null, logoDir);
      return;
    }
    if (file.fieldname === 'internalAttachments') {
      const tempDir = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../media'), 'attachments/projects/temp');
      ensureDir(tempDir);
      cb(null, tempDir);
      return;
    }
    const fallbackDir = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../media'), 'uploads/tmp');
    ensureDir(fallbackDir);
    cb(null, fallbackDir);
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'logo') {
      const projectId = req.params.id || req.body.id;
      const ext = path.extname(file.originalname);
      cb(null, `${projectId}${ext}`);
      return;
    }
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

// Configure multer for attachment uploads
const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const projectId = req.params.projectId;
        const uploadPath = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../media'), 'attachments/projects', projectId);
        
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
  { name: 'logo', maxCount: 1 },
  { name: 'internalAttachments', maxCount: 10 },
]);
const attachmentUpload = multer({ 
    storage: attachmentStorage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Configure multer for internal attachment uploads (accepts 'file' field name)
const internalAttachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(process.env.MEDIA_PATH || path.join(__dirname, '../media'), 'attachments/projects/temp');
    ensureDir(tempDir);
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});
const internalAttachmentUpload = multer({ 
  storage: internalAttachmentStorage,
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
router.post('/', uploadFields, projectController.addProject);
router.put('/:id', uploadFields, projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

// Attachment routes (matching developer pattern - deletes from internalAttachments)
router.delete('/:id/attachments/:attachmentId', projectController.deleteProjectAttachment);
// Legacy routes for regular attachments (if still needed)
router.post('/:projectId/attachments', attachmentUpload.single('file'), projectController.uploadProjectAttachment);
router.get('/:projectId/attachments', projectController.getProjectAttachments);

// Internal attachment routes
router.post('/:id/internal-attachments', internalAttachmentUpload.single('file'), projectController.uploadInternalAttachment);
router.delete('/:id/internal-attachments/:attachmentId', projectController.deleteInternalAttachment);

module.exports = router;
