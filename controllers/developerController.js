const developerData = require('../data/developerData');
const path = require('path');
const fs = require('fs');


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

    // Check if a file is uploaded
    if (req.file) {
        const logoFileName = `${addedDeveloper._id}${path.extname(req.file.originalname)}`;
        const logoFilePath = path.join(process.env.MEDIA_PATH,'logos/developer/', logoFileName);
        
        // Move the uploaded file to the specified directory
        fs.rename(req.file.path, logoFilePath, (err) => {
            if (err) {
                console.error('Error renaming file:', err); // Log error details
                return res.status(500).json({ message: 'Failed to save logo file' });
            }
            // Add the logo path to the developer data
            const final = developerData.updateItem(addedDeveloper._id, { logo: `logos/developer/${logoFileName}` });
            return res.status(201).json(final);
        });
    } else {
        // Handle case where no logo is uploaded
        const final = developerData.updateItem(addedDeveloper._id, { logo: `` });
        return res.status(201).json(final);
    }
}

// Controller for updating a developer
function updateDeveloper(req, res) {
    const updatedData = req.body;
    const developerId = req.params.id;

  const updatedDeveloper = developerData.updateItem(developerId, updatedData);

  if (updatedDeveloper) {
    // If a new logo file is uploaded, update the logo path
    if (req.file) {
      const logoPath = `${developerId}${path.extname(req.file.originalname)}`;
      developerData.updateItem(developerId, { logo: `logos/developer/${logoPath}` });
    }
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
