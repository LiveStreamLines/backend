const fs = require('fs');
const path = require('path');
const cameraData = require('../models/cameraData');
const developerData = require('../models/developerData');
const projectData = require("../models/projectData");

const mediaRoot = process.env.MEDIA_PATH + '/upload';


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
    const servernow = new Date(); // Get the current time
    const now = new Date(servernow.getTime() + 4 * 60 * 60 * 1000);


    // Prepare response array
    const lastPictures = cameras.map(camera => {
        const project = projectData.getItemById(camera.project);
        const developer = developerData.getItemById(camera.developer);
        const projectTag = project.projectTag;
        const developerTag = developer.developerTag;
        const cameraName = camera.camera;
        const serverfolder = camera.serverFolder;
        const FullName = developerTag + "/" + projectTag + "/" + cameraName + `(${serverfolder})`;
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
        // Extract full timestamp from filename (assuming YYYYMMDD_HHmmss format)
        const timestampMatch = lastPic.match(/^(\d{8})(\d{6})/); // Match YYYYMMDDHHmmss
        if (!timestampMatch) {
            return { FullName, error: 'Invalid file format' };
        }

        const [_, datePart, timePart] = timestampMatch;
        const lastPicDateTime = new Date(
            parseInt(datePart.slice(0, 4)),      // Year
            parseInt(datePart.slice(4, 6)) - 1, // Month (0-based)
            parseInt(datePart.slice(6, 8)),     // Day
            parseInt(timePart.slice(0, 2)),     // Hours
            parseInt(timePart.slice(2, 4)),     // Minutes
            parseInt(timePart.slice(4, 6))      // Seconds
        );

        // Calculate the difference in hours and minutes
        const diffMs = now - lastPicDateTime;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));


        return {
            FullName,
            lastPhoto: lastPicDateTime.toISOString(),
            servertime: servernow,
            adjusted: now,
            diff: `${diffHours}h:${diffMinutes}min`
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
