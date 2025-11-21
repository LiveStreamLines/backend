const userData = require('../models/userData');
const logger = require('../logger');
const path = require('path');
const fs = require('fs');

function getLogoFilePath(fileName) {
    return path.join(process.env.MEDIA_PATH, 'logos', 'user', fileName);
}


// Controller for getting all Users
function getAllUsers(req, res) {
    const users = userData.getAllItems();
    res.json(users);
}

// Controller for getting a single User by ID
function getUserById(req, res) {
    const user = userData.getItemById(req.params.id);
    if (user) {
        res.json(user);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
}

// Controller for adding a new User
function addUser(req, res) {
    const newUser = { ...req.body };
    
    // Parse array fields from JSON strings (FormData sends arrays as JSON strings)
    const arrayFields = ['accessibleDevelopers', 'accessibleProjects', 'accessibleCameras', 'accessibleServices'];
    arrayFields.forEach(field => {
        if (newUser[field] && typeof newUser[field] === 'string') {
            try {
                newUser[field] = JSON.parse(newUser[field]);
            } catch (e) {
                // If parsing fails, try to handle as comma-separated string
                newUser[field] = newUser[field].split(',').map(item => item.trim()).filter(item => item.length > 0);
            }
        }
        // Ensure it's an array
        if (!Array.isArray(newUser[field])) {
            newUser[field] = [];
        }
    });
    
    // Handle canManageDevProjCam as a string ('all', 'camera_configuration', or empty string)
    // Always ensure the field is set, even if empty
    if (newUser.canManageDevProjCam !== undefined && newUser.canManageDevProjCam !== null && newUser.canManageDevProjCam !== '') {
        if (typeof newUser.canManageDevProjCam === 'string') {
            // Keep as string if it's 'all' or 'camera_configuration', otherwise set to empty string
            if (newUser.canManageDevProjCam !== 'all' && newUser.canManageDevProjCam !== 'camera_configuration') {
                newUser.canManageDevProjCam = '';
            }
        } else {
            // Legacy: if it's a boolean true, convert to 'all' for backward compatibility
            if (newUser.canManageDevProjCam === true) {
                newUser.canManageDevProjCam = 'all';
            } else {
                newUser.canManageDevProjCam = '';
            }
        }
    } else {
        // Set to empty string if undefined, null, or empty string
        newUser.canManageDevProjCam = '';
    }
    
    // Parse boolean fields from strings (FormData sends booleans as strings 'true'/'false')
    const booleanFields = [
        'hasUaeAccess', 'hasSaudiAccess', 'hasCameraMonitorAccess',
        'hasInventoryAccess', 'hasMemoryAccess', 'canAddUser', 'canGenerateVideoAndPics',
        'canWatchCameraMonitor', 'canCreateMonitorTask', 'canHoldMaintenance', 'canDeletePhoto',
        'canSeeAllTasks', 'canAddDeviceType', 'canAddDeviceStock', 'canSeeAllInventory',
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
    
    // Validate country field - only accept 'UAE' or 'Saudi Arabia'
    if (newUser.country !== undefined && newUser.country !== null && newUser.country !== '') {
        const validCountries = ['UAE', 'Saudi Arabia'];
        if (!validCountries.includes(newUser.country)) {
            // If invalid country value, set to undefined (will not be stored)
            delete newUser.country;
        }
    } else {
        // If empty or undefined, remove the field
        delete newUser.country;
    }
    
    //check if email is new
    const usercheck = userData.getUserByEmail(req.body.email);
    logger.info(usercheck);
    
    if (usercheck.length !== 0) {
        logger.info("email is already there");
        res.status(500).json({message: "Email is already Registered"});
    } else {    
        const addedUser = userData.addItem(newUser);

        if (req.file) {
            try {
                const logoFileName = `${addedUser._id}${path.extname(req.file.originalname)}`;
                const logoFilePath = getLogoFilePath(logoFileName);

                fs.mkdirSync(path.dirname(logoFilePath), { recursive: true });
                if (req.file.path !== logoFilePath) {
                    fs.renameSync(req.file.path, logoFilePath);
                }

                const finalUser = userData.updateItem(addedUser._id, { logo: `logos/user/${logoFileName}` });
                return res.status(201).json(finalUser);
            } catch (error) {
                logger.error('Error saving user logo:', error);
                return res.status(500).json({ message: 'Failed to save logo file' });
            }
        } else {
            const finalUser = userData.updateItem(addedUser._id, { logo: '' });
            return res.status(201).json(finalUser);
        }
    }
}

// Controller for updating a User
function updateUser(req, res) {
    const userId = req.params.id;
    const updatePayload = { ...req.body };
    
    // Parse array fields from JSON strings (FormData sends arrays as JSON strings)
    const arrayFields = ['accessibleDevelopers', 'accessibleProjects', 'accessibleCameras', 'accessibleServices'];
    arrayFields.forEach(field => {
        if (updatePayload[field] && typeof updatePayload[field] === 'string') {
            try {
                updatePayload[field] = JSON.parse(updatePayload[field]);
            } catch (e) {
                // If parsing fails, try to handle as comma-separated string
                updatePayload[field] = updatePayload[field].split(',').map(item => item.trim()).filter(item => item.length > 0);
            }
        }
        // Ensure it's an array (if field exists but is not an array, make it empty array)
        if (updatePayload[field] !== undefined && !Array.isArray(updatePayload[field])) {
            updatePayload[field] = [];
        }
    });
    
    // Handle canManageDevProjCam as a string ('all', 'camera_configuration', or empty string)
    // Always ensure the field is set, even if empty
    if (updatePayload.canManageDevProjCam !== undefined && updatePayload.canManageDevProjCam !== null && updatePayload.canManageDevProjCam !== '') {
        if (typeof updatePayload.canManageDevProjCam === 'string') {
            // Keep as string if it's 'all' or 'camera_configuration', otherwise set to empty string
            if (updatePayload.canManageDevProjCam !== 'all' && updatePayload.canManageDevProjCam !== 'camera_configuration') {
                updatePayload.canManageDevProjCam = '';
            }
        } else {
            // Legacy: if it's a boolean true, convert to 'all' for backward compatibility
            if (updatePayload.canManageDevProjCam === true) {
                updatePayload.canManageDevProjCam = 'all';
            } else {
                updatePayload.canManageDevProjCam = '';
            }
        }
    } else {
        // Set to empty string if undefined, null, or empty string
        updatePayload.canManageDevProjCam = '';
    }
    
    // Parse boolean fields from strings (FormData sends booleans as strings 'true'/'false')
    const booleanFields = [
        'hasUaeAccess', 'hasSaudiAccess', 'hasCameraMonitorAccess',
        'hasInventoryAccess', 'hasMemoryAccess', 'canAddUser', 'canGenerateVideoAndPics',
        'canWatchCameraMonitor', 'canCreateMonitorTask', 'canHoldMaintenance', 'canDeletePhoto',
        'canSeeAllTasks', 'canAddDeviceType', 'canAddDeviceStock', 'canSeeAllInventory',
        'canAssignToUser', 'canArchiveMemory', 'isActive'
    ];
    booleanFields.forEach(field => {
        if (updatePayload[field] !== undefined && updatePayload[field] !== null) {
            if (typeof updatePayload[field] === 'string') {
                updatePayload[field] = updatePayload[field].toLowerCase() === 'true';
            } else {
                updatePayload[field] = !!updatePayload[field];
            }
        }
        // Don't set to false if undefined - let it remain undefined to preserve existing values
    });
    
    // Validate country field - only accept 'UAE' or 'Saudi Arabia'
    if (updatePayload.country !== undefined && updatePayload.country !== null && updatePayload.country !== '') {
        const validCountries = ['UAE', 'Saudi Arabia'];
        if (!validCountries.includes(updatePayload.country)) {
            // If invalid country value, remove it from update (preserve existing value)
            delete updatePayload.country;
        }
    } else if (updatePayload.country === '') {
        // If empty string is explicitly sent, set to undefined to clear the field
        updatePayload.country = undefined;
    }

    if (req.file) {
        try {
            const logoFileName = `${userId}${path.extname(req.file.originalname)}`;
            const logoFilePath = getLogoFilePath(logoFileName);

            fs.mkdirSync(path.dirname(logoFilePath), { recursive: true });
            if (req.file.path !== logoFilePath) {
                fs.renameSync(req.file.path, logoFilePath);
            }

            updatePayload.logo = `logos/user/${logoFileName}`;
        } catch (error) {
            logger.error('Error saving user logo:', error);
            return res.status(500).json({ message: 'Failed to save logo file' });
        }
    }

    const updatedUser = userData.updateItem(userId, updatePayload);
    if (updatedUser) {
        res.json(updatedUser);
    } else {
        res.status(404).json({ message: 'User not found' });
    }
}

// Controller for deleting a User
function deleteUser(req, res) {
    const isDeleted = userData.deleteItem(req.params.id);
    if (isDeleted) {
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'User not found' });
    }
}

module.exports = {
    getAllUsers,
    getUserById,
    addUser,
    updateUser,
    deleteUser
};
