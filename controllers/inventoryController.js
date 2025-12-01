const inventoryData = require('../models/inventoryData');
const developData = require('../models/developerData');
const projectData = require('../models/projectData');
const cameraData = require('../models/cameraData');
const deviceTypeData = require('../models/deviceTypeData');

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
                status: req.body.status || 'available',
                assignmentHistory: req.body.assignmentHistory || [],
                validityDays: req.body.validityDays || 365
            };
            
            // Include estimatedAge if provided (can be null to explicitly clear it)
            if (req.body.estimatedAge !== undefined) {
                newItem.estimatedAge = req.body.estimatedAge;
            }

            // Check if device type is no-serial
            const isNoSerial = (() => {
                if (!req.body.device || !req.body.device.type) {
                    return false;
                }
                const deviceTypes = deviceTypeData.getAllItems();
                const deviceType = deviceTypes.find(dt => {
                    const dtName = (dt.name || '').trim().toLowerCase();
                    const itemTypeName = (req.body.device.type || '').trim().toLowerCase();
                    return dtName === itemTypeName;
                });
                return deviceType ? (deviceType.noSerial === true) : false;
            })();

            // For no-serial devices, check if item with same type and model already exists
            if (isNoSerial && req.body.quantity !== undefined) {
                const allItems = inventoryData.getAllItems();
                const existingItem = allItems.find(item => {
                    // Check if it's a no-serial item (has quantity field and no serialNumber)
                    const itemIsNoSerial = item.quantity !== undefined && !item.device?.serialNumber;
                    if (!itemIsNoSerial) return false;
                    
                    // Check if device type matches (case-insensitive)
                    const itemType = (item.device?.type || '').trim().toLowerCase();
                    const newType = (req.body.device?.type || '').trim().toLowerCase();
                    if (itemType !== newType) return false;
                    
                    // Check if model matches (both may or may not have model)
                    const itemModel = (item.device?.model || '').trim().toLowerCase();
                    const newModel = (req.body.device?.model || '').trim().toLowerCase();
                    return itemModel === newModel;
                });
                
                if (existingItem) {
                    // Add quantity to existing item
                    const addQuantity = req.body.quantity;
                    existingItem.quantity = (existingItem.quantity || 0) + addQuantity;
                    existingItem.inStock = (existingItem.inStock || 0) + addQuantity;
                    
                    // Update the item
                    const data = inventoryData.updateItem(existingItem._id, {
                        quantity: existingItem.quantity,
                        inStock: existingItem.inStock
                    });
                    return res.status(200).json({ success: true, data });
                } else {
                    // Create new item with quantity
                    newItem.quantity = req.body.quantity;
                    newItem.inStock = req.body.quantity;
                    newItem.userAssignments = [];
                    newItem.projectAssignments = [];
                }
            }
            
            // Include country if provided
            if (req.body.country !== undefined) {
                newItem.country = req.body.country;
            }
            
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
            const projectData = req.body.developer && req.body.project && req.body.camera ? {
                developer: req.body.developer,
                project: req.body.project,
                camera: req.body.camera,
                qty: req.body.qty || null
            } : null;
            const data = inventoryData.unassignItem(req.params.id, req.body.reason, projectData);
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
            const data = inventoryData.unassignUserItem(
                req.params.id, 
                req.body.reason,
                req.body.userId || null,
                req.body.qty || null
            );
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
    },

    getInventoryAsssignation: function(req, res) {
        try {
            const data = inventoryData.getItemsBySerial(req.params.serial);
            console.log(data);
            if (data.length > 0 && data[0].currentAssignment) {
                const assignment = data[0].currentAssignment;
                const developer = developData.getItemById(assignment.developer);
                const project = projectData.getItemById(assignment.project);
                const camera = cameraData.getItemById(assignment.camera);
                res.json({ success: true, data: {developer: developer.developerTag, project: project.projectTag, camera: camera.camera} });
            } else {
                res.json({error: "the serial either not registred or not assigned"});
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
};