const express = require('express');
const router = express.Router();
const salesOrderController = require('../controllers/salesOrderController');
const authMiddleware = require('../controllers/authMiddleware');
// Apply authentication middleware to all routes
router.use(authMiddleware);

// Get all sales orders
router.get('/', salesOrderController.getAllSalesOrders);
// Get next order number
router.get('/next-number', salesOrderController.generateNextOrderNumber);
// Get next invoice number
router.get('/next-invoice-number', salesOrderController.generateNextInvoiceNumber);
// Get sales order by ID
router.get('/:id', salesOrderController.getSalesOrderById);
// Create new sales order
router.post('/', salesOrderController.createSalesOrder);
// Update sales order
router.put('/:id', salesOrderController.updateSalesOrder);
// Delete sales order
router.delete('/:id', salesOrderController.deleteSalesOrder);
// Get sales orders by customer
router.get('/customer/:customerId', salesOrderController.getSalesOrdersByCustomer);

module.exports = router; 