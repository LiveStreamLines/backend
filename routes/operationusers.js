// routes/operationusers.js
const express = require('express');
const router = express.Router();
const operationusersController = require('../controllers/operationusersController');
const authMiddleware = require('../controllers/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(authMiddleware);

const userLogoDir = path.join(process.env.MEDIA_PATH, 'logos', 'operationuser');
if (!fs.existsSync(userLogoDir)) {
    fs.mkdirSync(userLogoDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, userLogoDir);
    },
    filename: (req, file, cb) => {
        const userId = req.params.id || req.body.id || `temp-${Date.now()}`;
        const ext = path.extname(file.originalname);
        cb(null, `${userId}${ext}`);
    }
});

const upload = multer({ 
    storage,
    limits: { files: 1 }
});

const normalizeFileUpload = (req, res, next) => {
    if (req.files && req.files.length > 0) {
        req.file = req.files[0];
    }
    next();
};

router.get('/', operationusersController.getAllOperationUsers);
router.get('/:id', operationusersController.getOperationUserById);
router.post('/', upload.any(), normalizeFileUpload, operationusersController.addOperationUser);
router.put('/:id', upload.any(), normalizeFileUpload, operationusersController.updateOperationUser);
router.delete('/:id', operationusersController.deleteOperationUser);

module.exports = router;

