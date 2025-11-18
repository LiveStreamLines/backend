// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../controllers/authMiddleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

router.use(authMiddleware);

const userLogoDir = path.join(process.env.MEDIA_PATH, 'logos', 'user');
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

const upload = multer({ storage });

router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.post('/', upload.single('logo'), userController.addUser);
router.put('/:id', upload.single('logo'), userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
