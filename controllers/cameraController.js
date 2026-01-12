const fs = require('fs');
const path = require('path');
const cameraData = require('../models/cameraData');
const developerData = require('../models/developerData');
const projectData = require("../models/projectData");
const operationusersData = require('../models/operationusersData');
const logger = require('../logger');
const cameraStatusHistoryController = require('./cameraStatusHistoryController');
const s3Service = require('../utils/s3Service');
const DataModel = require('../models/DataModel');

const mediaRoot = process.env.MEDIA_PATH + '/upload';
const MEDIA_ROOT = process.env.MEDIA_PATH || path.join(__dirname, '../media');
const CAMERA_ATTACHMENTS_DIR = path.join(MEDIA_ROOT, 'attachments/cameras');
const TEMP_ATTACHMENT_DIR = path.join(CAMERA_ATTACHMENTS_DIR, 'temp');

const ensureDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

ensureDirectory(CAMERA_ATTACHMENTS_DIR);
ensureDirectory(TEMP_ATTACHMENT_DIR);

const generateAttachmentId = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const getUploadedBy = (user) => {
    if (!user) {
        return 'system';
    }
    return user._id || user.id || user.userId || user.email || user.name || 'system';
};

const moveInternalAttachments = async (cameraId, files = [], user) => {
    if (!files || files.length === 0) {
        return [];
    }

    const uploadedBy = getUploadedBy(user);
    const attachments = [];

    for (const file of files) {
        try {
            if (!fs.existsSync(file.path)) {
                logger.warn(`File not found at temp path: ${file.path}`);
                continue;
            }

            const newFileName = `${cameraId}_${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
            const s3Key = s3Service.getCameraInternalAttachmentKey(cameraId, newFileName);

            // Upload to S3
            const uploadResult = await s3Service.uploadFileToS3(
                file.path,
                s3Key,
                file.mimetype,
                file.originalname
            );

            // Clean up temp file
            try {
                fs.unlinkSync(file.path);
            } catch (unlinkError) {
                logger.warn('Failed to clean up temp attachment', unlinkError);
            }

            attachments.push({
                _id: generateAttachmentId(),
                name: newFileName,
                originalName: file.originalname,
                size: file.size,
                type: file.mimetype,
                url: uploadResult.url,
                s3Key: s3Key, // Store S3 key for deletion later
                uploadedAt: new Date().toISOString(),
                uploadedBy,
            });
        } catch (error) {
            logger.error('Failed to upload internal attachment to S3', error);
            // Clean up temp file on error
            try {
                if (fs.existsSync(file.path)) {
                    fs.unlinkSync(file.path);
                }
            } catch (unlinkError) {
                logger.warn('Failed to clean up temp attachment on error', unlinkError);
            }
        }
    }

    return attachments;
};

function resolveUserIdentity(req) {
    let resolvedName = 'Unknown';
    let resolvedId = null;
    const resolvedEmail = req.user?.email ?? null;

    if (req.user && req.user.email) {
        const users = operationusersData.getAllItems();
        const user = users.find(u => u.email === req.user.email);
        if (user) {
            resolvedName = user.name || user._id || 'Unknown';
            resolvedId = user._id || user.id || null;
        }
    }

    if (resolvedName === 'Unknown' && req.user) {
        resolvedName = req.user.name || req.user.userName || req.user._id || req.user.id || req.user.userId || 'Unknown';
        resolvedId = resolvedId || req.user._id || req.user.id || req.user.userId || null;
    }

    return {
        name: resolvedName,
        id: resolvedId,
        email: resolvedEmail,
    };
}

function getMaintenanceCycleStartDate(req, res) {
    const cycleStartDate = process.env.MAINTENANCE_CYCLE_START_DATE || null;
    res.json({ cycleStartDate });
}


// Controller for getting all Cameras
function getAllCameras(req, res) {
    const cameras = cameraData.getAllItems();
    res.json(cameras);
}

function getAllActiveCameras(req, res) {
    const cameras = cameraData.getAllActiveItems();
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
async function addCamera(req, res) {
    try {
        const newCamera = { ...req.body };
        
        // Initialize internal attachments array
        newCamera.internalAttachments = [];

        const addedCamera = cameraData.addItem(newCamera);

        // Handle internal attachments if provided
        const attachmentFiles = req.files?.internalAttachments || [];
        if (attachmentFiles.length > 0) {
            const attachments = await moveInternalAttachments(addedCamera._id, attachmentFiles, req.user);
            if (attachments.length > 0) {
                const response = cameraData.updateItem(addedCamera._id, { internalAttachments: attachments }) || addedCamera;
                return res.status(201).json(response);
            }
        }

        return res.status(201).json(addedCamera);
    } catch (error) {
        logger.error('Error adding camera', error);
        res.status(500).json({ message: 'Failed to add camera', error: error.message });
    }
}

// Controller for updating a Camera
async function updateCamera(req, res) {
    try {
        const cameraId = req.params.id;
        const camera = cameraData.getItemById(cameraId);
        
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        const updatedData = { ...req.body };
        
        // Don't update internalAttachments from body - handle files separately
        delete updatedData.internalAttachments;

        // Handle internal attachments if provided
        const attachmentFiles = req.files?.internalAttachments || [];
        if (attachmentFiles.length > 0) {
            const attachments = await moveInternalAttachments(cameraId, attachmentFiles, req.user);
            if (attachments.length > 0) {
                const merged = [...(camera.internalAttachments || []), ...attachments];
                updatedData.internalAttachments = merged;
            }
        }

        const updatedCamera = cameraData.updateItem(cameraId, updatedData);
        if (updatedCamera) {
            res.json(updatedCamera);
        } else {
            res.status(404).json({ message: 'Camera not found' });
        }
    } catch (error) {
        logger.error('Error updating camera', error);
        res.status(500).json({ message: 'Failed to update camera', error: error.message });
    }
}

// Controller for updating camera maintenance status flags
// Allows toggling backend-persisted flags like:
// - maintenanceStatus.photoDirty
// - maintenanceStatus.lowImages (e.g. "Maintenance / less image number")
// - maintenanceStatus.wrongTime (images with incorrect timestamp)
function updateCameraMaintenanceStatus(req, res) {
    try {
        const { photoDirty, lowImages, betterView, wrongTime } = req.body || {};
        
        // Ensure at least one field is provided
        if (photoDirty === undefined && lowImages === undefined && betterView === undefined && wrongTime === undefined) {
            return res.status(400).json({ message: 'No maintenance status fields provided.' });
        }

        const camera = cameraData.getItemById(req.params.id);
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        // Get current status from history instead of camera.maintenanceStatus
        const currentStatusFromHistory = cameraStatusHistoryController.getCurrentStatusFromHistory(camera._id);
        const userIdentity = resolveUserIdentity(req);

        if (typeof photoDirty === 'boolean') {
            const currentlyPhotoDirty = currentStatusFromHistory.photoDirty;
            // Only log if status is actually changing
            if (photoDirty !== currentlyPhotoDirty) {
                const now = new Date().toISOString();
                if (photoDirty) {
                    cameraStatusHistoryController.recordStatusChange({
                        cameraId: camera._id,
                        cameraName: camera.camera,
                        developerId: camera.developer,
                        projectId: camera.project,
                        statusType: 'photoDirty',
                        action: 'on',
                        performedBy: userIdentity.name,
                        performedByEmail: userIdentity.email,
                        performedAt: now,
                    });
                } else {
                    cameraStatusHistoryController.recordStatusChange({
                        cameraId: camera._id,
                        cameraName: camera.camera,
                        developerId: camera.developer,
                        projectId: camera.project,
                        statusType: 'photoDirty',
                        action: 'off',
                        performedBy: userIdentity.name,
                        performedByEmail: userIdentity.email,
                        performedAt: now,
                    });
                }
            }
        }
        if (typeof lowImages === 'boolean') {
            const currentlyLowImages = currentStatusFromHistory.lowImages;
            if (lowImages !== currentlyLowImages) {
                const now = new Date().toISOString();
                cameraStatusHistoryController.recordStatusChange({
                    cameraId: camera._id,
                    cameraName: camera.camera,
                    developerId: camera.developer,
                    projectId: camera.project,
                    statusType: 'lowImages',
                    action: lowImages ? 'on' : 'off',
                    performedBy: userIdentity.name,
                    performedByEmail: userIdentity.email,
                    performedAt: now,
                });
            }
        }
        if (typeof betterView === 'boolean') {
            const currentlyBetterView = currentStatusFromHistory.betterView;
            if (betterView !== currentlyBetterView) {
                const now = new Date().toISOString();
                cameraStatusHistoryController.recordStatusChange({
                    cameraId: camera._id,
                    cameraName: camera.camera,
                    developerId: camera.developer,
                    projectId: camera.project,
                    statusType: 'betterView',
                    action: betterView ? 'on' : 'off',
                    performedBy: userIdentity.name,
                    performedByEmail: userIdentity.email,
                    performedAt: now,
                });
            }
        }
        if (typeof wrongTime === 'boolean') {
            const currentlyWrongTime = currentStatusFromHistory.wrongTime;
            if (wrongTime !== currentlyWrongTime) {
                const now = new Date().toISOString();
                cameraStatusHistoryController.recordStatusChange({
                    cameraId: camera._id,
                    cameraName: camera.camera,
                    developerId: camera.developer,
                    projectId: camera.project,
                    statusType: 'wrongTime',
                    action: wrongTime ? 'on' : 'off',
                    performedBy: userIdentity.name,
                    performedByEmail: userIdentity.email,
                    performedAt: now,
                });
            }
        }

        // Get updated status from history and return it with camera info
        const updatedStatusFromHistory = cameraStatusHistoryController.getCurrentStatusFromHistory(camera._id);
        const statusMetadata = {
            photoDirty: cameraStatusHistoryController.getStatusMetadataFromHistory(camera._id, 'photoDirty'),
            betterView: cameraStatusHistoryController.getStatusMetadataFromHistory(camera._id, 'betterView'),
            lowImages: cameraStatusHistoryController.getStatusMetadataFromHistory(camera._id, 'lowImages'),
            wrongTime: cameraStatusHistoryController.getStatusMetadataFromHistory(camera._id, 'wrongTime'),
            shutterExpiry: cameraStatusHistoryController.getStatusMetadataFromHistory(camera._id, 'shutterExpiry'),
            deviceExpiry: cameraStatusHistoryController.getStatusMetadataFromHistory(camera._id, 'deviceExpiry'),
        };

        logger.info(
          `Updated camera maintenance status: ${camera.camera} (ID: ${camera._id})`,
        );

        // Return camera with status from history
        res.json({
            ...camera,
            maintenanceStatusFromHistory: updatedStatusFromHistory,
            maintenanceStatusMetadata: statusMetadata,
        });
    } catch (error) {
        logger.error('Error updating camera maintenance status:', error);
        res.status(500).json({ message: error.message });
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

// Attachment Controllers (matching developer pattern)
async function deleteAttachment(req, res) {
    try {
        const cameraId = req.params.id || req.params.cameraId;
        const attachmentId = req.params.attachmentId;

        const camera = cameraData.getItemById(cameraId);
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        const attachments = camera.internalAttachments || [];
        const attachmentIndex = attachments.findIndex(att => att._id === attachmentId);

        if (attachmentIndex === -1) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        const attachment = attachments[attachmentIndex];
        
        // Delete from S3 if it exists
        if (attachment.s3Key || attachment.url) {
            try {
                const s3Key = attachment.s3Key || s3Service.extractKeyFromUrl(attachment.url);
                if (s3Key) {
                    await s3Service.deleteFromS3(s3Key);
                    logger.info(`Deleted internal attachment from S3: ${s3Key}`);
                }
            } catch (s3Error) {
                logger.warn(`Failed to delete internal attachment from S3: ${attachment.url}`, s3Error);
                // Continue with database deletion even if S3 deletion fails
            }
        }

        // Remove attachment from array
        const updatedAttachments = attachments.filter(att => att._id !== attachmentId);
        const updatedCamera = cameraData.updateItem(cameraId, { 
            internalAttachments: updatedAttachments 
        });

        if (updatedCamera) {
            return res.json(updatedCamera);
        } else {
            return res.status(500).json({ message: 'Failed to update camera' });
        }
    } catch (error) {
        logger.error('Error deleting attachment', error);
        return res.status(500).json({ message: 'Failed to delete attachment' });
    }
}

function uploadCameraAttachment(req, res) {
    try {
        const cameraId = req.params.cameraId;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Check if camera exists
        const camera = cameraData.getItemById(cameraId);
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        // Create attachment object
        const dataModel = new DataModel('temp');
        const attachment = {
            _id: dataModel.generateCustomId(),
            name: file.filename,
            originalName: file.originalname,
            size: file.size,
            type: file.mimetype,
            url: `/backend/media/attachments/cameras/${cameraId}/${file.filename}`,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user?.id || 'system'
        };

        // Add attachment to camera
        if (!camera.attachments) {
            camera.attachments = [];
        }
        camera.attachments.push(attachment);

        // Update camera in database
        cameraData.updateItem(cameraId, { attachments: camera.attachments });

        res.status(201).json(attachment);
    } catch (error) {
        logger.error('Error uploading camera attachment:', error);
        res.status(500).json({ message: error.message });
    }
}

function getCameraAttachments(req, res) {
    try {
        const cameraId = req.params.cameraId;
        
        // Check if camera exists
        const camera = cameraData.getItemById(cameraId);
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        const attachments = camera.attachments || [];
        res.json(attachments);
    } catch (error) {
        logger.error('Error getting camera attachments:', error);
        res.status(500).json({ message: error.message });
    }
}

function deleteCameraAttachment(req, res) {
    try {
        const cameraId = req.params.cameraId;
        const attachmentId = req.params.attachmentId;
        
        // Check if camera exists
        const camera = cameraData.getItemById(cameraId);
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        if (!camera.attachments) {
            return res.status(404).json({ message: 'No attachments found' });
        }

        // Find and remove attachment
        const attachmentIndex = camera.attachments.findIndex(att => att._id === attachmentId);
        if (attachmentIndex === -1) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        const attachment = camera.attachments[attachmentIndex];
        
        // Delete file from filesystem
        const filePath = path.join(MEDIA_ROOT, 'attachments/cameras', cameraId, attachment.name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove attachment from camera
        camera.attachments.splice(attachmentIndex, 1);
        cameraData.updateItem(cameraId, { attachments: camera.attachments });

        res.json({ message: 'Attachment deleted successfully' });
    } catch (error) {
        logger.error('Error deleting camera attachment:', error);
        res.status(500).json({ message: error.message });
    }
}

// Controller for uploading an internal attachment
async function uploadInternalAttachment(req, res) {
    try {
        const cameraId = req.params.id || req.params.cameraId;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const camera = cameraData.getItemById(cameraId);
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        // Move file to temp directory first (multer already did this, but we need to process it)
        const tempFiles = [{ ...file, originalname: file.originalname }];
        const attachments = await moveInternalAttachments(cameraId, tempFiles, req.user);
        
        if (attachments.length > 0) {
            const merged = [...(camera.internalAttachments || []), ...attachments];
            const updatedCamera = cameraData.updateItem(cameraId, { internalAttachments: merged });
            if (updatedCamera) {
                return res.status(201).json(updatedCamera);
            }
        }

        return res.status(500).json({ message: 'Failed to upload attachment' });
    } catch (error) {
        logger.error('Error uploading internal attachment', error);
        return res.status(500).json({ message: 'Failed to upload attachment' });
    }
}

async function deleteInternalAttachment(req, res) {
    try {
        const cameraId = req.params.id;
        const attachmentId = req.params.attachmentId;

        const camera = cameraData.getItemById(cameraId);
        if (!camera) {
            return res.status(404).json({ message: 'Camera not found' });
        }

        const attachments = camera.internalAttachments || [];
        const attachmentIndex = attachments.findIndex(a => a._id === attachmentId);

        if (attachmentIndex === -1) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        const attachment = attachments[attachmentIndex];
        
        // Delete from S3 if it exists
        if (attachment.s3Key || attachment.url) {
            try {
                const s3Key = attachment.s3Key || s3Service.extractKeyFromUrl(attachment.url);
                if (s3Key) {
                    await s3Service.deleteFromS3(s3Key);
                    logger.info(`Deleted internal attachment from S3: ${s3Key}`);
                }
            } catch (s3Error) {
                logger.warn(`Failed to delete internal attachment from S3: ${attachment.url}`, s3Error);
                // Continue with database deletion even if S3 deletion fails
            }
        }

        // Remove attachment from array
        const updatedAttachments = attachments.filter(a => a._id !== attachmentId);
        const updatedCamera = cameraData.updateItem(cameraId, {
            internalAttachments: updatedAttachments
        });

        if (updatedCamera) {
            res.json(updatedCamera);
        } else {
            res.status(404).json({ message: 'Camera not found' });
        }
    } catch (error) {
        logger.error('Error deleting internal attachment', error);
        res.status(500).json({ message: 'Failed to delete attachment', error: error.message });
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
    updateCameraMaintenanceStatus,
    updateCameraInstallationDate,
    updateCameraInvoiceInfo,
    updateCameraInvoicedDuration,
    deleteCamera,
    getMaintenanceCycleStartDate,
    deleteAttachment,
    uploadCameraAttachment,
    getCameraAttachments,
    deleteCameraAttachment,
    uploadInternalAttachment,
    deleteInternalAttachment
};
