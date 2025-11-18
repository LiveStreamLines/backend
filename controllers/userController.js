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
    const newUser = req.body;
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
