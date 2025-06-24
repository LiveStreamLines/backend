const salesOrderData = require('../models/salesOrderData');
const logger = require('../logger');

const salesOrderController = {
    // Get all sales orders
    getAllSalesOrders: (req, res) => {
        try {
            const salesOrders = salesOrderData.getAllItems();
            res.json(salesOrders);
        } catch (error) {
            logger.error('Error getting all sales orders:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Get sales order by ID
    getSalesOrderById: (req, res) => {
        try {
            const salesOrder = salesOrderData.getItemById(req.params.id);
            if (!salesOrder) {
                return res.status(404).json({ message: 'Sales order not found' });
            }
            res.json(salesOrder);
        } catch (error) {
            logger.error('Error getting sales order by ID:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Create new sales order
    createSalesOrder: (req, res) => {
        try {
            console.log('Received sales order data:', req.body);
            
            // Accept all fields from the request body
            const order = {
                ...req.body,
                status: req.body.status || 'Draft',
            };

            console.log('Processed order data:', order);

            const newSalesOrder = salesOrderData.addItem(order);
            res.status(201).json(newSalesOrder);
        } catch (error) {
            logger.error('Error creating sales order:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Update sales order
    updateSalesOrder: (req, res) => {
        try {
            // Accept all fields from the request body
            const updatedSalesOrder = salesOrderData.updateItem(req.params.id, req.body);
            if (!updatedSalesOrder) {
                return res.status(404).json({ message: 'Sales order not found' });
            }
            res.json(updatedSalesOrder);
        } catch (error) {
            logger.error('Error updating sales order:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Delete sales order
    deleteSalesOrder: (req, res) => {
        try {
            const success = salesOrderData.deleteItem(req.params.id);
            if (!success) {
                return res.status(404).json({ message: 'Sales order not found' });
            }
            res.json({ message: 'Sales order deleted successfully' });
        } catch (error) {
            logger.error('Error deleting sales order:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Get sales orders by customer
    getSalesOrdersByCustomer: (req, res) => {
        try {
            const salesOrders = salesOrderData.getItemsByCustomer(req.params.customerId);
            res.json(salesOrders);
        } catch (error) {
            logger.error('Error getting sales orders by customer:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Generate next order number
    generateNextOrderNumber: (req, res) => {
        try {
            const nextNumber = salesOrderData.generateOrderNumber();
            res.json({ nextNumber });
        } catch (error) {
            logger.error('Error generating next order number:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Generate next invoice number
    generateNextInvoiceNumber: (req, res) => {
        try {
            const nextNumber = salesOrderData.generateInvoiceNumber();
            res.json({ nextNumber });
        } catch (error) {
            logger.error('Error generating next invoice number:', error);
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = salesOrderController; 