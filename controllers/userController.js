const userData = require('../models/userData');

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
    const addedUser = userData.addItem(newUser);
    res.status(201).json(addedUser);
}

// Controller for updating a User
function updateUser(req, res) {
    const updatedUser = userData.updateItem(req.params.id, req.body);
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
