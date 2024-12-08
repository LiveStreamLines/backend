const cameraData = require('../models/cameraData');


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
    const isDeleted = cameraData.deleteItem(req.params._id);
    if (isDeleted) {
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'Camera not found' });
    }
}

module.exports = {
    getAllCameras,
    getCameraById,
    getCameraByProject,
    addCamera,
    updateCamera,
    deleteCamera
};
