// routes/projects.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

const multer = require('multer');
const path = require('path');

// Configure multer for file upload
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

const upload = multer({ storage });

router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.get('/dev/:id', projectController.getProjectByDeveloper);
router.post('/', upload.single('logo'),projectController.addProject);
router.put('/:id', upload.single('logo'), projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

module.exports = router;
