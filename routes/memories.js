const express = require('express');
const router = express.Router();
const memoryController = require('../controllers/memoryController');
//const authMiddleware = require('../controllers/authMiddleware');

//router.use(authMiddleware);

router.get('/', memoryController.getMemories);
router.get('/:id', memoryController.getMemorybyId);
router.post('/', memoryController.addMemory);
router.put('/:id', memoryController.updateMemory);


module.exports = router;