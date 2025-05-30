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
            const salesOrderData = {
                customerId: req.body.customerId,
                customerName: req.body.customerName,
                contractStartDate: req.body.contractStartDate,
                contractEndDate: req.body.contractEndDate,
                contractDuration: req.body.contractDuration,
                monthlyFee: req.body.monthlyFee,
                totalContractValue: req.body.totalContractValue,
                status: 'Draft',
                cameras: req.body.cameras || [],
                paymentSchedule: generatePaymentSchedule(
                    req.body.contractStartDate,
                    req.body.contractDuration,
                    req.body.monthlyFee
                ),
                billingAddress: req.body.billingAddress,
                contactPerson: req.body.contactPerson,
                notes: req.body.notes
            };

            const newSalesOrder = salesOrderData.addItem(salesOrderData);
            res.status(201).json(newSalesOrder);
        } catch (error) {
            logger.error('Error creating sales order:', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Update sales order
    updateSalesOrder: (req, res) => {
        try {
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
    }
};

// Helper function to generate payment schedule
function generatePaymentSchedule(startDate, duration, monthlyFee) {
    const schedule = [];
    const start = new Date(startDate);
    
    for (let i = 0; i < duration; i++) {
        const dueDate = new Date(start);
        dueDate.setMonth(start.getMonth() + i);
        
        schedule.push({
            dueDate: dueDate.toISOString(),
            amount: monthlyFee,
            status: 'Pending'
        });
    }
    
    return schedule;
}

module.exports = salesOrderController; 