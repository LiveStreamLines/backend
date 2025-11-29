const operationusersData = require('../models/operationusersData');
const logger = require('../logger');
const path = require('path');
const fs = require('fs');

function getLogoFilePath(fileName) {
    return path.join(process.env.MEDIA_PATH, 'logos', 'operationuser', fileName);
}

// Controller for getting all Operation Users
function getAllOperationUsers(req, res) {
    const users = operationusersData.getAllItems();
    res.json(users);
}

// Controller for getting a single Operation User by ID
function getOperationUserById(req, res) {
    const user = operationusersData.getItemById(req.params.id);
    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'Operation user not found' });
    }
}

// Controller for adding a new Operation User
function addOperationUser(req, res) {
    try {
        const newUser = { ...req.body };
        
        // Parse array fields from JSON strings (FormData sends arrays as JSON strings)
        const arrayFields = ['accessibleDevelopers', 'accessibleProjects', 'accessibleCameras', 'accessibleServices'];
        arrayFields.forEach(field => {
            if (newUser[field] && typeof newUser[field] === 'string') {
                try {
                    newUser[field] = JSON.parse(newUser[field]);
                } catch (e) {
                    newUser[field] = newUser[field].split(',').map(item => item.trim()).filter(item => item.length > 0);
                }
            }
            if (!Array.isArray(newUser[field])) {
                newUser[field] = [];
            }
        });
        
        // Handle canManageDevProjCam as a string
        if (newUser.canManageDevProjCam !== undefined && newUser.canManageDevProjCam !== null && newUser.canManageDevProjCam !== '') {
            if (typeof newUser.canManageDevProjCam === 'string') {
                if (newUser.canManageDevProjCam !== 'all' && newUser.canManageDevProjCam !== 'camera_configuration') {
                    newUser.canManageDevProjCam = '';
                }
            } else {
                if (newUser.canManageDevProjCam === true) {
                    newUser.canManageDevProjCam = 'all';
                } else {
                    newUser.canManageDevProjCam = '';
                }
            }
        } else {
            newUser.canManageDevProjCam = '';
        }
        
        // Parse boolean fields from strings
        const booleanFields = [
            'hasUaeAccess', 'hasSaudiAccess', 'hasCameraMonitorAccess',
            'hasInventoryAccess', 'hasMemoryAccess', 'canAddUser', 'canGenerateVideoAndPics',
            'canWatchCameraMonitor', 'canCreateMonitorTask', 'canHoldMaintenance', 'canDeletePhoto',
            'canTogglePhotoDirtyBetterView', 'canSeeAllTasks', 'canAddDeviceType', 'canAddDeviceStock', 'canSeeAllInventory',
            'canAssignToUser', 'canArchiveMemory', 'isActive'
        ];
        booleanFields.forEach(field => {
            if (newUser[field] !== undefined && newUser[field] !== null) {
                if (typeof newUser[field] === 'string') {
                    newUser[field] = newUser[field].toLowerCase() === 'true';
                } else {
                    newUser[field] = !!newUser[field];
                }
            } else {
                newUser[field] = false;
            }
        });
        
        // Validate country field - only accept 'UAE', 'Saudi Arabia', or 'All'
        if (newUser.country !== undefined && newUser.country !== null && newUser.country !== '') {
            const validCountries = ['UAE', 'Saudi Arabia', 'All'];
            if (!validCountries.includes(newUser.country)) {
                delete newUser.country;
            }
        } else {
            delete newUser.country;
        }
        
        // Validate role field
        const validRoles = ['Super Admin', 'Admin', 'Operator', 'Finance'];
        if (newUser.role && !validRoles.includes(newUser.role)) {
            newUser.role = 'Operator';
        }
        
        // Ensure email is lowercase
        if (newUser.email) {
            newUser.email = newUser.email.toLowerCase();
        }
        
        // Handle logo file if provided
        if (req.file) {
            const logoDir = path.dirname(getLogoFilePath(''));
            if (!fs.existsSync(logoDir)) {
                fs.mkdirSync(logoDir, { recursive: true });
            }
            
            const userId = operationusersData.generateCustomId();
            const ext = path.extname(req.file.originalname);
            const logoFileName = `${userId}${ext}`;
            const logoPath = path.join(logoDir, logoFileName);
            
            try {
                fs.renameSync(req.file.path, logoPath);
                newUser.logo = `logos/operationuser/${logoFileName}`;
            } catch (error) {
                logger.error('Error saving operation user logo', error);
            }
        }
        
        const addedUser = operationusersData.addItem(newUser);
        
        // If logo was uploaded but user ID wasn't set before, update with logo path
        if (req.file && addedUser._id && !addedUser.logo) {
            const ext = path.extname(req.file.originalname);
            const logoFileName = `${addedUser._id}${ext}`;
            const logoPath = getLogoFilePath(logoFileName);
            if (fs.existsSync(req.file.path)) {
                try {
                    fs.renameSync(req.file.path, logoPath);
                    const updatedUser = operationusersData.updateItem(addedUser._id, { logo: `logos/operationuser/${logoFileName}` });
                    return res.status(201).json(updatedUser || addedUser);
                } catch (error) {
                    logger.error('Error saving operation user logo after user creation', error);
                }
            }
        }
        
        return res.status(201).json(addedUser);
    } catch (error) {
        logger.error('Error adding operation user', error);
        return res.status(500).json({ message: 'Failed to add operation user' });
    }
}

// Controller for updating an Operation User
function updateOperationUser(req, res) {
    try {
        const userId = req.params.id;
        const existingUser = operationusersData.getItemById(userId);
        
        if (!existingUser) {
            return res.status(404).json({ message: 'Operation user not found' });
        }
        
        const updateData = { ...req.body };
        
        // Parse array fields
        const arrayFields = ['accessibleDevelopers', 'accessibleProjects', 'accessibleCameras', 'accessibleServices'];
        arrayFields.forEach(field => {
            if (updateData[field] !== undefined) {
                if (typeof updateData[field] === 'string') {
                    try {
                        updateData[field] = JSON.parse(updateData[field]);
                    } catch (e) {
                        updateData[field] = updateData[field].split(',').map(item => item.trim()).filter(item => item.length > 0);
                    }
                }
                if (!Array.isArray(updateData[field])) {
                    updateData[field] = [];
                }
            }
        });
        
        // Handle canManageDevProjCam
        if (updateData.canManageDevProjCam !== undefined && updateData.canManageDevProjCam !== null && updateData.canManageDevProjCam !== '') {
            if (typeof updateData.canManageDevProjCam === 'string') {
                if (updateData.canManageDevProjCam !== 'all' && updateData.canManageDevProjCam !== 'camera_configuration') {
                    updateData.canManageDevProjCam = '';
                }
            } else {
                if (updateData.canManageDevProjCam === true) {
                    updateData.canManageDevProjCam = 'all';
                } else {
                    updateData.canManageDevProjCam = '';
                }
            }
        }
        
        // Parse boolean fields
        const booleanFields = [
            'hasUaeAccess', 'hasSaudiAccess', 'hasCameraMonitorAccess',
            'hasInventoryAccess', 'hasMemoryAccess', 'canAddUser', 'canGenerateVideoAndPics',
            'canWatchCameraMonitor', 'canCreateMonitorTask', 'canHoldMaintenance', 'canDeletePhoto',
            'canTogglePhotoDirtyBetterView', 'canSeeAllTasks', 'canAddDeviceType', 'canAddDeviceStock', 'canSeeAllInventory',
            'canAssignToUser', 'canArchiveMemory', 'isActive'
        ];
        booleanFields.forEach(field => {
            if (updateData[field] !== undefined && updateData[field] !== null) {
                if (typeof updateData[field] === 'string') {
                    updateData[field] = updateData[field].toLowerCase() === 'true';
                } else {
                    updateData[field] = !!updateData[field];
                }
            }
        });
        
        // Validate country
        if (updateData.country !== undefined && updateData.country !== null && updateData.country !== '') {
            const validCountries = ['UAE', 'Saudi Arabia', 'All'];
            if (!validCountries.includes(updateData.country)) {
                delete updateData.country;
            }
        }
        
        // Validate role
        if (updateData.role) {
            const validRoles = ['Super Admin', 'Admin', 'Operator', 'Finance'];
            if (!validRoles.includes(updateData.role)) {
                delete updateData.role;
            }
        }
        
        // Handle email lowercase
        if (updateData.email) {
            updateData.email = updateData.email.toLowerCase();
        }
        
        // Handle logo file if provided
        if (req.file) {
            const logoDir = path.dirname(getLogoFilePath(''));
            if (!fs.existsSync(logoDir)) {
                fs.mkdirSync(logoDir, { recursive: true });
            }
            
            const ext = path.extname(req.file.originalname);
            const logoFileName = `${userId}${ext}`;
            const logoPath = path.join(logoDir, logoFileName);
            
            try {
                // Delete old logo if exists
                if (existingUser.logo) {
                    const oldLogoPath = path.join(process.env.MEDIA_PATH, existingUser.logo);
                    if (fs.existsSync(oldLogoPath)) {
                        fs.unlinkSync(oldLogoPath);
                    }
                }
                
                fs.renameSync(req.file.path, logoPath);
                updateData.logo = `logos/operationuser/${logoFileName}`;
            } catch (error) {
                logger.error('Error saving operation user logo', error);
            }
        }
        
        const updatedUser = operationusersData.updateItem(userId, updateData);
        return res.json(updatedUser);
    } catch (error) {
        logger.error('Error updating operation user', error);
        return res.status(500).json({ message: 'Failed to update operation user' });
    }
}

// Controller for deleting an Operation User
function deleteOperationUser(req, res) {
    try {
        const userId = req.params.id;
        const user = operationusersData.getItemById(userId);
        
        if (!user) {
            return res.status(404).json({ message: 'Operation user not found' });
        }
        
        // Delete logo if exists
        if (user.logo) {
            const logoPath = path.join(process.env.MEDIA_PATH, user.logo);
            if (fs.existsSync(logoPath)) {
                try {
                    fs.unlinkSync(logoPath);
                } catch (error) {
                    logger.warn('Failed to delete operation user logo', error);
                }
            }
        }
        
        const isDeleted = operationusersData.deleteItem(userId);
        if (isDeleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Operation user not found' });
        }
    } catch (error) {
        logger.error('Error deleting operation user', error);
        res.status(500).json({ message: 'Failed to delete operation user' });
    }
}

module.exports = {
    getAllOperationUsers,
    getOperationUserById,
    addOperationUser,
    updateOperationUser,
    deleteOperationUser,
};

