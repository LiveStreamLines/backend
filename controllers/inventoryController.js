const inventoryData = require('../models/inventoryData');
const logger = require('../logger');

module.exports = {
    getAllInventory: function(req, res) {
        try {
            const data = inventoryData.getAllItems();
            res.json(data);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
        //res.json('hello');
    },

    getInventoryById: function(req, res) {
        try {
            const data = inventoryData.getItemById(req.params.id);
            if (!data) {
                return res.status(404).json({ success: false, message: 'Inventory item not found' });
            }
            res.json(data);
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    createInventory: function(req, res) {
        try {
            const newItem = {
                device: req.body.device,
                status: 'available',
                assignmentHistory: [],
                validityDays: req.body.validityDays || 365
            };
            const data = inventoryData.addItem(newItem);
            res.status(201).json({ success: true, data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    updateInventory: function(req, res){
        try {
            const updateItem = req.body;
            const data = inventoryData.updateItem(req.params.id, updateItem);
            res.status(201).json({success: true, data});
        } catch (error) {
            res.status(400).json({ success: false, message: error.message});
        }
    },

    assignInventoryItem: function(req, res) {
        try {
            const data = inventoryData.assignItem(req.params.id, req.body);
            if (!data) {
                return res.status(404).json({ success: false, message: 'Inventory item not found' });
            }
            res.json({ success: true, data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

     assignInventoryItemtoUser: function(req, res) {
        try {
            const data = inventoryData.assignItemtoUser(req.params.id, req.body);
            if (!data) {
                return res.status(404).json({ success: false, message: 'Inventory item not found' });
            }
            res.json({ success: true, data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    unassignInventoryItem: function(req, res) {
        try {
            const data = inventoryData.unassignItem(req.params.id, req.body.reason);
            if (!data) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Inventory item not found or not assigned' 
                });
            }
            res.json({ success: true, data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    unassignUserInventoryItem: function(req, res) {
        try {
            const data = inventoryData.unassignUserItem(req.params.id, req.body.reason);
            if (!data) {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Inventory item not found or not assigned' 
                });
            }
            res.json({ success: true, data });
        } catch (error) {
            res.status(400).json({ success: false, message: error.message });
        }
    },

    getInventoryByDeveloper: function(req, res) {
        try {
            const data = inventoryData.getItemsByDeveloperId(req.params.developerId);
            res.json({ success: true, data });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    },

    getInventoryByProject: function(req, res) {
        try {
            const data = inventoryData.getItemsByProjectId(req.params.projectId);
            res.json({ success: true, data });
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};