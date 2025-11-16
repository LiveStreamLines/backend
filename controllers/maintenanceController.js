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
            // Ensure creator information is registered with user ID (not just name)
            const taskData = { ...req.body };
            
            // Priority 1: Use addedUserId from request body if provided
            // Priority 2: Look up user by email from JWT token to get _id
            // Priority 3: Try direct fields from req.user
            if (!taskData.addedUserId && req.user) {
                // JWT token contains email, so look up user by email to get _id
                if (req.user.email) {
                    const users = userData.getAllItems();
                    const user = users.find(u => u.email === req.user.email);
                    if (user) {
                        // Ensure we save the user ID (_id), not the name
                        taskData.addedUserId = user._id;
                        taskData.addedUserName = user.name;
                        logger.info(`Task creator registered: ID=${user._id}, Name=${user.name}`);
                    }
                }
                
                // Fallback: try direct fields from req.user
                if (!taskData.addedUserId) {
                    taskData.addedUserId = req.user._id || req.user.id || req.user.userId;
                    taskData.addedUserName = req.user.name || req.user.userName;
                }
            }
            
            // Validate that addedUserId is set (it should be the user's _id, not name)
            if (taskData.addedUserId) {
                // Ensure addedUserId is actually an ID (not a name)
                // If it looks like a name (contains spaces or is too short), try to find the user
                if (taskData.addedUserId.length < 10 || taskData.addedUserId.includes(' ')) {
                    logger.warn('addedUserId appears to be a name, looking up user', { addedUserId: taskData.addedUserId });
                    const users = userData.getAllItems();
                    const user = users.find(u => u.name === taskData.addedUserId || u.email === taskData.addedUserId);
                    if (user) {
                        taskData.addedUserId = user._id;
                        taskData.addedUserName = user.name;
                    }
                }
                logger.info(`Task will be saved with creator: addedUserId=${taskData.addedUserId}, addedUserName=${taskData.addedUserName}`);
            } else {
                logger.warn('Task created without creator ID (addedUserId)', { body: req.body, user: req.user });
            }
            
            const maintenance = maintenanceData.addItem(taskData);
            res.status(201).json(maintenance);
        } catch (error) {
            logger.error('Error creating maintenance task', error);
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