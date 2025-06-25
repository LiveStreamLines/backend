const salesOrderData = require('../models/salesOrderData');
const cameraData = require('../models/cameraData');
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

            // Cameras will be created when the sales order is confirmed
            // No camera creation here for Draft orders

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
            const salesOrderId = req.params.id;
            const updateData = req.body;
            
            // Get the current sales order to check status changes
            const currentSalesOrder = salesOrderData.getItemById(salesOrderId);
            if (!currentSalesOrder) {
                return res.status(404).json({ message: 'Sales order not found' });
            }

            // Check if status is changing to 'Confirmed' and cameras need to be created
            if (updateData.status === 'Confirmed' && currentSalesOrder.status === 'Draft' && 
                currentSalesOrder.cameras && Array.isArray(currentSalesOrder.cameras) && currentSalesOrder.cameras.length > 0) {
                
                logger.info(`Creating camera records for confirmed sales order: ${salesOrderId}`);
                const createdCameras = [];
                
                for (const cameraInfo of currentSalesOrder.cameras) {
                    // Create camera record
                    const newCameraData = {
                        camera: cameraInfo.cameraName,
                        cameraId: cameraInfo.cameraId,
                        project: currentSalesOrder.projectId,
                        developer: currentSalesOrder.customerId,
                        projectTag: currentSalesOrder.projectTag || currentSalesOrder.projectName,
                        developerTag: currentSalesOrder.developerTag || currentSalesOrder.customerName,
                        status: 'Pending',
                        installedDate: null, // Will be set later when camera is installed
                        monthlyFee: cameraInfo.monthlyFee,
                        contractDuration: cameraInfo.contractDuration,
                        serverFolder: cameraInfo.cameraId, // Using cameraId as server folder
                        isActive: true,
                        createdDate: new Date().toISOString(),
                        // Sales order tracking
                        salesOrderId: currentSalesOrder._id,
                        salesOrderNumber: currentSalesOrder.orderNumber,
                        invoicedDuration: 0,
                        invoices: []
                    };
                    
                    const createdCamera = cameraData.addItem(newCameraData);
                    createdCameras.push(createdCamera);
                    
                    // Update the camera info in the sales order with the generated camera ID
                    cameraInfo.cameraId = createdCamera._id;
                    
                    logger.info(`Created camera record: ${createdCamera.camera} (ID: ${createdCamera._id})`);
                }
                
                logger.info(`Created ${createdCameras.length} camera records for confirmed sales order`);
                
                // Update the cameras array in the update data with the new camera IDs
                updateData.cameras = currentSalesOrder.cameras;
            }

            // Accept all fields from the request body
            const updatedSalesOrder = salesOrderData.updateItem(salesOrderId, updateData);
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