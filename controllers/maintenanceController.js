const maintenanceData = require('../models/maintenanceData');
const userData = require('../models/userData');
const logger = require('../logger');

const maintenanceController = {
    // Get all maintenance requests
    getAllMaintenance: (req, res) => {
        try {
            const maintenance = maintenanceData.getAllItems();
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get maintenance request by ID
    getMaintenanceById: (req, res) => {
        try {
            const maintenance = maintenanceData.getItemById(req.params.id);
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Create new maintenance request
    createMaintenance: (req, res) => {
        try {
            // Ensure creator information is registered
            const taskData = { ...req.body };
            
            // If addedUserId is not provided, try to get it from the authenticated user
            if (!taskData.addedUserId && req.user) {
                // JWT token contains email, so look up user by email to get _id
                if (req.user.email) {
                    const users = userData.getAllItems();
                    const user = users.find(u => u.email === req.user.email);
                    if (user) {
                        taskData.addedUserId = user._id;
                        taskData.addedUserName = user.name;
                    }
                }
                
                // Fallback: try direct fields from req.user
                if (!taskData.addedUserId) {
                    taskData.addedUserId = req.user._id || req.user.id || req.user.userId;
                    taskData.addedUserName = req.user.name || req.user.userName;
                }
            }
            
            // If still no creator info, log a warning but continue
            if (!taskData.addedUserId) {
                logger.warn('Task created without creator information', { body: req.body, user: req.user });
            }
            
            const maintenance = maintenanceData.addItem(taskData);
            res.status(201).json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Update maintenance request
    updateMaintenance: (req, res) => {
        try {
            const maintenance = maintenanceData.updateItem(req.params.id, req.body);
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Delete maintenance request
    deleteMaintenance: (req, res) => {
        try {
            const success = maintenanceData.deleteItem(req.params.id);
            if (!success) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }
            res.json({ message: 'Maintenance request deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get maintenance requests by camera ID
    getMaintenanceByCamera: (req, res) => {
        try {
            const maintenance = maintenanceData.getAllItems().filter(
                item => item.cameraId === req.params.cameraId
            );
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get maintenance requests by assigned user
    getMaintenanceByUser: (req, res) => {
        try {
            const maintenance = maintenanceData.getAllItems().filter(
                item => item.assignedUser === req.params.userId
            );
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = maintenanceController;