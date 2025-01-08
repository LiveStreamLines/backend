const cameraData = require('../models/cameraData');
const developerData = require('../models/developerData');
const projectData = require("../models/projectData");


// Controller for getting all Cameras
function getAllCameras(req, res) {
    const cameras = cameraData.getAllItems();
    res.json(cameras);
}

// Controller for getting a single Camera by ID
function getCameraById(req, res) {
    const camera = cameraData.getItemById(req.params.id);
    if (camera) {
        res.json(camera);
    } else {
        res.status(404).json({ message: 'Camera not found' });
    }
}

// Controller for getting cameras in Developer
function getCameraByProject(req, res) {
    const camera = cameraData.getCameraByProjectId(req.params.id);
    if (camera) {
        res.json(camera);
    } else {
        res.status(404).json({ message: 'Camera not found' });
    }
}

function getLastPicturesFromAllCameras(req, res) {
    // Fetch all cameras
    const cameras = cameraData.getAllItems(); // Assuming this function retrieves all cameras

    // Prepare response array
    const lastPictures = cameras.map(camera => {

        const project = projectData.getItemById(camera.project);
        const developer = developerData.getItemById(camera.developer);
        const projectTag = project.projectTag;
        const developerTag = developer.developerTag;
        const cameraName = camera.camera;
        const FullName = developerTag + "/" + projectTag + "/" + cameraName;
        // Define the path to the camera's pictures
        const cameraPath = path.join(mediaRoot, developerTag, projectTag, cameraName, 'large');

        // Check if the camera directory exists
        if (!fs.existsSync(cameraPath)) {
            return { FullName, error: 'Camera directory not found' };
        }

        // Read all image files in the camera directory
        const files = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));

        if (files.length === 0) {
            return { FullName, error: 'No pictures found in camera directory' };
        }

        // Sort files by name to get the last picture
        const sortedFiles = files.sort();
        const lastPic = sortedFiles[sortedFiles.length - 1];

        return {
            FullName,
            lastPhoto: lastPic.replace('.jpg', '')
        };
    });

    res.json(lastPictures);
}

// Controller for adding a new Camera
function addCamera(req, res) {
    const newCamera = req.body;
    const addedCamera = cameraData.addItem(newCamera);
    res.status(201).json(addedCamera);
}

// Controller for updating a Camera
function updateCamera(req, res) {
    const updatedCamera = cameraData.updateItem(req.params.id, req.body);
    if (updatedCamera) {
        res.json(updatedCamera);
    } else {
        res.status(404).json({ message: 'Camera not found' });
    }
}

// Controller for deleting a Camera
function deleteCamera(req, res) {
    const isDeleted = cameraData.deleteItem(req.params.id);
    if (isDeleted) {
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'Camera not found' });
    }
}

module.exports = {
    getAllCameras,
    getLastPicturesFromAllCameras,
    getCameraById,
    getCameraByProject,
    addCamera,
    updateCamera,
    deleteCamera
};
