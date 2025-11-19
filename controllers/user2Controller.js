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
    
    // Parse boolean fields from strings (FormData sends booleans as strings 'true'/'false')
    const booleanFields = [
        'hasUaeAccess', 'hasSaudiAccess', 'canManageDevProjCam', 'hasCameraMonitorAccess',
        'hasInventoryAccess', 'hasMemoryAccess', 'canAddUser', 'canGenerateVideoAndPics',
        'canWatchCameraMonitor', 'canCreateMonitorTask', 'canHoldMaintenance', 'canDeletePhoto',
        'canSeeAllTasks', 'canAddDeviceType', 'canAddDeviceStock', 'canAssignUnassignUser',
        'canAssignUnassignProject', 'canArchiveMemory', 'isActive'
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
    
    // Parse boolean fields from strings (FormData sends booleans as strings 'true'/'false')
    const booleanFields = [
        'hasUaeAccess', 'hasSaudiAccess', 'canManageDevProjCam', 'hasCameraMonitorAccess',
        'hasInventoryAccess', 'hasMemoryAccess', 'canAddUser', 'canGenerateVideoAndPics',
        'canWatchCameraMonitor', 'canCreateMonitorTask', 'canHoldMaintenance', 'canDeletePhoto',
        'canSeeAllTasks', 'canAddDeviceType', 'canAddDeviceStock', 'canAssignUnassignUser',
        'canAssignUnassignProject', 'canArchiveMemory', 'isActive'
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
