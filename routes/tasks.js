// routes/tasks.js
const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../controllers/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(authMiddleware);

// Configure multer for attachment uploads
const attachmentStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(process.env.MEDIA_PATH, 'attachments/tasks', 'temp');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        const random = Math.round(Math.random() * 1e9);
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

router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.post('/', attachmentUpload.array('attachments', 10), taskController.createTask);
router.put('/:id', attachmentUpload.array('attachments', 10), taskController.updateTask);
router.post('/:id/notes', attachmentUpload.array('attachments', 10), taskController.addNote);
router.post('/:id/close', taskController.closeTask);
router.delete('/:id', taskController.deleteTask);

module.exports = router;

