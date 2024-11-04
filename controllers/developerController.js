const developerData = require('../data/developerData');
const multer = require('multer');
const path = require('path');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, '/var/media/logos/developer');  // Target directory for logos
    },
    filename: (req, file, cb) => {
      const developerId = req.params.id || req.body.id; // Use id from params if updating, or from body if adding
      const ext = path.extname(file.originalname);      // Preserve file extension
      cb(null, `${developerId}${ext}`);                 // Rename file as developerId.ext
    }
  });
  
  const upload = multer({ storage });
  

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
    try {
        const newDeveloper = req.body;
        const addedDeveloper = developerData.addItem(newDeveloper); // Add the developer

        // If there's a logo file, set the file path
        if (req.file) {
            const logoPath = `logos/developer/${addedDeveloper.id}${path.extname(req.file.originalname)}`;
            developerData.updateItem(addedDeveloper.id, { logo: logoPath });
        }

        res.status(201).json(addedDeveloper);
  } catch (error) {
    res.status(500).json({ message: 'Error adding developer', error });
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
      const logoPath = `/var/media/logos/developer/${developerId}${path.extname(req.file.originalname)}`;
      developerData.updateItem(developerId, { logo: logoPath });
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
