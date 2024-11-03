const developerData = require('../data/developerData');

// Controller for getting all developers
function getAllDevelopers(req, res) {
    const developers = developerData.getAllItems();
    res.json(developers);
}

// Controller for getting a single developer by ID
function getDeveloperById(req, res) {
    const developer = developerData.getItemById(req.params.id);
    if (developer) {
        res.json(developer);
    } else {
        res.status(404).json({ message: 'Developer not found' });
    }
}

// Controller for adding a new developer
function addDeveloper(req, res) {
    const newDeveloper = req.body;
    const addedDeveloper = developerData.addItem(newDeveloper);
    res.status(201).json(addedDeveloper);
}

// Controller for updating a developer
function updateDeveloper(req, res) {
    const updatedDeveloper = developerData.updateItem(req.params.id, req.body);
    if (updatedDeveloper) {
        res.json(updatedDeveloper);
    } else {
        res.status(404).json({ message: 'Developer not found' });
    }
}

// Controller for deleting a developer
function deleteDeveloper(req, res) {
    const isDeleted = developerData.deleteItem(req.params._id);
    if (isDeleted) {
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'Developer not found' });
    }
}

module.exports = {
    getAllDevelopers,
    getDeveloperById,
    addDeveloper,
    updateDeveloper,
    deleteDeveloper
};
