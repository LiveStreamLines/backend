// routes/developers.js
const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

router.get('/', developerController.getAllDevelopers);
router.get('/:id', developerController.getDeveloperById);
router.post('/', upload.single('logo'), developerController.addDeveloper);
router.put('/:id', upload.single('logo'), developerController.updateDeveloper);
router.delete('/:id', developerController.deleteDeveloper);

module.exports = router;
