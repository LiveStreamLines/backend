const maintenanceData = require('../models/maintenanceData');

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
            const maintenance = maintenanceData.addItem({
                dateOfRequest: req.body.dateOfRequest,
                taskType: req.body.taskType,
                assignedUser: req.body.assignedUser,
                userComment: req.body.userComment,
                status: req.body.status,
                cameraId: req.body.cameraId
            });
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