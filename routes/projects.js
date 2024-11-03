// routes/projects.js
const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.get('/dev/:id', projectController.getProjectByDeveloper);
router.post('/', projectController.addProject);
router.put('/:id', projectController.updateProject);
router.delete('/:id', projectController.deleteProject);

module.exports = router;
