const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
//const authMiddleware = require('../controllers/authMiddleware');

// Protect all routes
//router.use(authMiddleware);

// Routes matching the project pattern
router.get('/', inventoryController.getAllInventory);
router.post('/', inventoryController.createInventory);
router.get('/:id', inventoryController.getInventoryById);
router.put('/:id', inventoryController.updateInventory);
router.patch('/assign/:id', inventoryController.assignInventoryItem);
router.patch('/unassign-user/:id', inventoryController.assignInventoryItemtoUser);
router.patch('/unassign/:id', inventoryController.unassignInventoryItem);
//router.patch('/:id/retire', inventoryController.);

module.exports = router;