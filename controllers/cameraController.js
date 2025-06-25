const fs = require('fs');
const path = require('path');
const cameraData = require('../models/cameraData');
const developerData = require('../models/developerData');
const projectData = require("../models/projectData");
const logger = require('../logger');

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

function getCameraByDeveloperId(req, res) {
    const camera = cameraData.getCameraByDeveloperId(req.params.id);
    if (camera) {
        res.json(camera);
    } else {
        res.status(404).json({ message: 'Camera not found' });
    }
}

function getCameraByProjectTag(req, res) {
    const project = projectData.getProjectByTag(req.params.tag);
    const camera = cameraData.getCameraByProjectId(project[0]._id);
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
        
        // Check if project and developer exist
        if (!project) {
            return { 
                FullName: `Unknown Project/${camera.camera}(${camera.serverFolder || 'Unknown'})`, 
                error: 'Project not found',
                cameraId: camera._id,
                projectId: camera.project
            };
        }
        
        if (!developer) {
            return { 
                FullName: `${project.projectTag || 'Unknown'}/${camera.camera}(${camera.serverFolder || 'Unknown'})`, 
                error: 'Developer not found',
                cameraId: camera._id,
                developerId: camera.developer
            };
        }
        
        const projectTag = project.projectTag;
        const developerTag = developer.developerTag;
        const projectId = project._id;
        const developerId = developer._id;
        const projectName = project.projectName;
        const developerName = developer.developerName;
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
            FullName: FullName,
            developerId: developerId,
            projectId: projectId,
            developerTag: developerTag,
            projectTag: projectTag,
            developer: developerName,
            project: projectName,
            cameraName: cameraName,
            serverfolder: serverfolder,
            lastPhoto: lastPic,
            lastPhotoTime: lastPicDateTime.toISOString()            
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

// Controller for updating camera installation date
function updateCameraInstallationDate(req, res) {
    try {
        const { installedDate } = req.body;
        
        if (!installedDate) {
            return res.status(400).json({ message: 'Installed date is required' });
        }

        const updateData = {
            installedDate: new Date(installedDate).toISOString(),
            status: 'Installed'
        };

        const updatedCamera = cameraData.updateItem(req.params.id, updateData);
        if (updatedCamera) {
            logger.info(`Updated camera installation date: ${updatedCamera.camera} (ID: ${updatedCamera._id})`);
            res.json(updatedCamera);
        } else {
            res.status(404).json({ message: 'Camera not found' });
        }
    } catch (error) {
        logger.error('Error updating camera installation date:', error);
        res.status(500).json({ message: error.message });
    }
}

// Controller for updating camera invoice information
function updateCameraInvoiceInfo(req, res) {
    try {
        const { invoiceNumber, invoiceSequence, amount, duration, generatedDate, status } = req.body;
        
        if (!invoiceNumber || !invoiceSequence || !amount || !duration) {
            return res.status(400).json({ message: 'Invoice information is required' });
        }

        const camera = cameraData.getItemById(req.params.id);
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        // Add the new invoice to the camera's invoices array
        const newInvoice = {
            invoiceNumber,
            invoiceSequence,
            amount,
            duration,
            generatedDate: new Date(generatedDate).toISOString(),
            status: status || 'Pending'
        };

        const existingInvoices = camera.invoices || [];
        const updatedInvoices = [...existingInvoices, newInvoice];

        const updateData = {
            invoices: updatedInvoices
        };

        const updatedCamera = cameraData.updateItem(req.params.id, updateData);
        if (updatedCamera) {
            logger.info(`Updated camera invoice info: ${updatedCamera.camera} (ID: ${updatedCamera._id}) - Invoice: ${invoiceNumber}`);
            res.json(updatedCamera);
        } else {
            res.status(404).json({ message: 'Camera not found' });
        }
    } catch (error) {
        logger.error('Error updating camera invoice info:', error);
        res.status(500).json({ message: error.message });
    }
}

// Controller for updating camera invoiced duration
function updateCameraInvoicedDuration(req, res) {
    try {
        const { invoicedDuration } = req.body;
        
        if (invoicedDuration === undefined || invoicedDuration === null) {
            return res.status(400).json({ message: 'Invoiced duration is required' });
        }

        const updateData = {
            invoicedDuration: invoicedDuration
        };

        const updatedCamera = cameraData.updateItem(req.params.id, updateData);
        if (updatedCamera) {
            logger.info(`Updated camera invoiced duration: ${updatedCamera.camera} (ID: ${updatedCamera._id}) - Duration: ${invoicedDuration}`);
            res.json(updatedCamera);
        } else {
            res.status(404).json({ message: 'Camera not found' });
        }
    } catch (error) {
        logger.error('Error updating camera invoiced duration:', error);
        res.status(500).json({ message: error.message });
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
    getCameraByProjectTag,
    getCameraByDeveloperId,
    addCamera,
    updateCamera,
    updateCameraInstallationDate,
    updateCameraInvoiceInfo,
    updateCameraInvoicedDuration,
    deleteCamera
};
