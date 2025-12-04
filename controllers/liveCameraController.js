const liveCameraData = require('../models/liveCameraData');
const logger = require('../logger');

// Controller for getting all live cameras
function getAllLiveCameras(req, res) {
    try {
        const cameras = liveCameraData.getAllItems();
        res.json(cameras);
    } catch (error) {
        logger.error('Error getting live cameras:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Controller for getting a live camera by ID
function getLiveCameraById(req, res) {
    try {
        const camera = liveCameraData.getItemById(req.params.id);
        if (camera) {
            res.json(camera);
        } else {
            res.status(404).json({ success: false, message: 'Live camera not found' });
        }
    } catch (error) {
        logger.error('Error getting live camera:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Controller for adding a new live camera
function addLiveCamera(req, res) {
    try {
        const newCamera = liveCameraData.addItem(req.body);
        res.status(201).json(newCamera);
    } catch (error) {
        logger.error('Error adding live camera:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Controller for updating a live camera
function updateLiveCamera(req, res) {
    try {
        const updatedCamera = liveCameraData.updateItem(req.params.id, req.body);
        if (updatedCamera) {
            res.json(updatedCamera);
        } else {
            res.status(404).json({ success: false, message: 'Live camera not found' });
        }
    } catch (error) {
        logger.error('Error updating live camera:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Controller for deleting a live camera
function deleteLiveCamera(req, res) {
    try {
        const isDeleted = liveCameraData.deleteItem(req.params.id);
        if (isDeleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ success: false, message: 'Live camera not found' });
        }
    } catch (error) {
        logger.error('Error deleting live camera:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    getAllLiveCameras,
    getLiveCameraById,
    addLiveCamera,
    updateLiveCamera,
    deleteLiveCamera
};

