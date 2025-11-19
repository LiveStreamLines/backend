// routes/developers.js
const express = require('express');
const router = express.Router();
const developerController = require('../controllers/developerController');
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
      const logoDir = path.join(process.env.MEDIA_PATH, 'logos/developer');
      ensureDir(logoDir);
      cb(null, logoDir);
      return;
    }
    if (file.fieldname === 'internalAttachments') {
      const tempDir = path.join(process.env.MEDIA_PATH, 'attachments/developers/temp');
      ensureDir(tempDir);
      cb(null, tempDir);
      return;
    }
    const fallbackDir = path.join(process.env.MEDIA_PATH, 'uploads/tmp');
    ensureDir(fallbackDir);
    cb(null, fallbackDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({ storage });
const uploadFields = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'internalAttachments', maxCount: 10 },
]);

router.get('/', developerController.getAllDevelopers);
router.get('/:id', developerController.getDeveloperById);
router.get('/tag/:tag', developerController.getDeveloperbyTag);
router.post('/', uploadFields, developerController.addDeveloper);
router.put('/:id', uploadFields, developerController.updateDeveloper);
router.delete('/:id', developerController.deleteDeveloper);
router.delete('/:id/attachments/:attachmentId', developerController.deleteAttachment);

module.exports = router;
