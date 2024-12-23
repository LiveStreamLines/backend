// routes/users.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');

const authMiddleware = require('../controllers/authMiddleware');

router.use(authMiddleware);

router.post('/reset-password', userController.sendResetPasswordLink);
router.get('/', userController.getAllUsers);
router.get('/:id', userController.getUserById);
router.get('/email/:email', userController.getUserByEmail);
router.post('/', userController.addUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
