// routes/developers.js
const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

const multer = require('multer');
const path = require('path');


// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, process.env.MEDIA_PATH + '/logos/developer');  // Target directory for logos
    },
    filename: (req, file, cb) => {
      const developerId = req.params.id || req.body.id; // Use id from params if updating, or from body if adding
      const ext = path.extname(file.originalname);      // Preserve file extension
      cb(null, `${developerId}${ext}`);                 // Rename file as developerId.ext
    }
  });
  
  const upload = multer({ storage });
  
router.get('/', developerController.getAllDevelopers);
router.get('/:id', developerController.getDeveloperById);
router.get('/:tag', developerController.getDeveloperbyTag);
router.post('/', upload.single('logo'), developerController.addDeveloper);
router.put('/:id', upload.single('logo'), developerController.updateDeveloper);
router.delete('/:id', developerController.deleteDeveloper);

module.exports = router;
