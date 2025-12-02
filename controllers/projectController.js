const projectData = require('../models/projectData');
const developerData = require('../models/developerData'); // To validate developer selection
const path = require('path');
const fs = require('fs');
const logger = require('../logger');
const salesOrderData = require('../models/salesOrderData');
const multer = require('multer');
const DataModel = require('../models/DataModel');
const s3Service = require('../utils/s3Service');

const MEDIA_ROOT = process.env.MEDIA_PATH || path.join(__dirname, '../media');
const PROJECT_ATTACHMENTS_DIR = path.join(MEDIA_ROOT, 'attachments/projects');
const TEMP_ATTACHMENT_DIR = path.join(PROJECT_ATTACHMENTS_DIR, 'temp');

const ensureDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

ensureDirectory(PROJECT_ATTACHMENTS_DIR);
ensureDirectory(TEMP_ATTACHMENT_DIR);

const generateAttachmentId = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const getUploadedBy = (user) => {
    if (!user) {
        return 'system';
    }
    return user._id || user.id || user.userId || user.email || user.name || 'system';
};

const moveInternalAttachments = async (projectId, files = [], user) => {
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

            const newFileName = `${projectId}_${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
            const s3Key = s3Service.getProjectInternalAttachmentKey(projectId, newFileName);

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

// Get base URL for attachments (for remote deployment)
const getAttachmentBaseUrl = () => {
    // Use environment variable or default to /backend for production
    return process.env.ATTACHMENT_BASE_URL || '/backend';
};

/// Controller for getting all projects
function getAllProjects(req, res) {
    try {
        const projects = projectData.getAllItems();
        res.json(projects);
    } catch (error) {
        logger.error('Error getting all projects:', error);
        res.status(500).json({ message: error.message });
    }
}

// Controller for getting a single project by ID
function getProjectById(req, res) {
    try {
        const project = projectData.getItemById(req.params.id);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.json(project);
    } catch (error) {
        logger.error('Error getting project by ID:', error);
        res.status(500).json({ message: error.message });
    }
}

// Controller for getting projects in Developer
function getProjectByDeveloper(req, res) {
    const project = projectData.getProjectByDeveloperId(req.params.id);
    if (project) {
        res.json(project);
    } else {
        res.status(404).json({ message: 'Project not found' });
    }
}

function getProjectByDeveloperTag(req, res) {

    const developer = developerData.getDeveloperByTag(req.params.tag);
    logger.info(req.params.tag);
    logger.info(developer);

    const project = projectData.getProjectByDeveloperId(developer[0]._id);
    if (project) {
        res.json(project);
    } else {
        res.status(404).json({ message: 'Project not found' });
    }
}

function getProjectByTag(req, res) {
    const project = projectData.getProjectByTag(req.params.tag);
    if (project) {
        res.json(project);
    } else {
        res.status(404).json({ message: 'Project not found' });
    }
}


// Controller for adding a new Project
async function addProject(req, res) {
    try {
        const payload = {
            ...req.body,
            internalDescription: req.body.internalDescription || '',
            internalAttachments: [],
        };

        // Check if developer exists
        const developer = developerData.getItemById(payload.developer);
        if (!developer) {
            return res.status(400).json({ message: 'Invalid developer ID' });
        }

        const addedProject = projectData.addItem(payload);
        let response = addedProject;

        const logoFile = req.files?.logo?.[0];
        if (logoFile) {
            const logoFileName = `${addedProject._id}${path.extname(logoFile.originalname)}`;
            const logoFilePath = path.join(MEDIA_ROOT, 'logos/project/', logoFileName);
            fs.renameSync(logoFile.path, logoFilePath);
            response = projectData.updateItem(addedProject._id, { logo: `logos/project/${logoFileName}` }) || response;
        } else {
            response = projectData.updateItem(addedProject._id, { logo: `` }) || response;
        }

        const attachmentFiles = req.files?.internalAttachments || [];
        if (attachmentFiles.length > 0) {
            const attachments = await moveInternalAttachments(addedProject._id, attachmentFiles, req.user);
            if (attachments.length > 0) {
                response = projectData.updateItem(addedProject._id, { internalAttachments: attachments }) || response;
            }
        }

        return res.status(201).json(response);
    } catch (error) {
        logger.error('Error adding project', error);
        return res.status(500).json({ message: 'Failed to add project' });
    }
}

// Controller for updating a Project
async function updateProject(req, res) {
    try {
        const projectId = req.params.id;
        const updatedData = {
            ...req.body,
            internalDescription: req.body.internalDescription || '',
        };
        delete updatedData.internalAttachments;

        // Check if developer exists
        if (updatedData.developer) {
            const developer = developerData.getItemById(updatedData.developer);
            if (!developer) {
                return res.status(400).json({ message: 'Invalid developer ID' });
            }
        }

        let updatedProject = projectData.updateItem(projectId, updatedData);

        if (!updatedProject) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const logoFile = req.files?.logo?.[0];
        if (logoFile) {
            const logoFileName = `${projectId}${path.extname(logoFile.originalname)}`;
            const logoFilePath = path.join(MEDIA_ROOT, 'logos/project/', logoFileName);
            fs.renameSync(logoFile.path, logoFilePath);
            updatedProject = projectData.updateItem(projectId, { logo: `logos/project/${logoFileName}` }) || updatedProject;
        }

        const attachmentFiles = req.files?.internalAttachments || [];
        if (attachmentFiles.length > 0) {
            const attachments = await moveInternalAttachments(projectId, attachmentFiles, req.user);
            if (attachments.length > 0) {
                const merged = [...(updatedProject.internalAttachments || []), ...attachments];
                updatedProject = projectData.updateItem(projectId, { internalAttachments: merged }) || updatedProject;
            }
        }

        return res.json(updatedProject);
    } catch (error) {
        logger.error('Error updating project', error);
        return res.status(500).json({ message: 'Failed to update project' });
    }
}

// Controller for deleting a Project
function deleteProject(req, res) {
    try {
        const success = projectData.deleteItem(req.params.id);
        if (!success) {
            return res.status(404).json({ message: 'Project not found' });
        }
        res.json({ message: 'Project deleted successfully' });
    } catch (error) {
        logger.error('Error deleting project:', error);
        res.status(500).json({ message: error.message });
    }
}

// Get projects by developer
function getProjectsByDeveloper(req, res) {
    try {
        const projects = projectData.getItemsByDeveloper(req.params.developerId);
        res.json(projects);
    } catch (error) {
        logger.error('Error getting projects by developer:', error);
        res.status(500).json({ message: error.message });
    }
}

// Get available projects for sales orders (status "new" and no sales orders associated)
function getAvailableProjectsForSalesOrder(req, res) {
    try {
        const developerId = req.params.developerId;
        
        // Get all projects for this developer
        const allProjects = projectData.getItemsByDeveloper(developerId);
        
        // Get all sales orders to check which projects are already associated
        const allSalesOrders = salesOrderData.getAllItems();
        
        // Filter projects that are available for sales orders
        const availableProjects = allProjects.filter(project => {
            // Check if project status is "new"
            if (project.status !== 'new') {
                return false;
            }
            
            // Check if project is not already associated with any sales order
            const hasSalesOrder = allSalesOrders.some(salesOrder => 
                salesOrder.projectId === project._id
            );
            
            return !hasSalesOrder;
        });
        
        res.json(availableProjects);
    } catch (error) {
        logger.error('Error getting available projects for sales order:', error);
        res.status(500).json({ message: error.message });
    }
}

// Attachment Controllers
function uploadProjectAttachment(req, res) {
    try {
        const projectId = req.params.projectId;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Check if project exists
        const project = projectData.getItemById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        // Create attachment object
        const dataModel = new DataModel('temp');
        const attachment = {
            _id: dataModel.generateCustomId(),
            name: file.filename,
            originalName: file.originalname,
            size: file.size,
            type: file.mimetype,
            url: `/backend/media/attachments/projects/${projectId}/${file.filename}`,
            uploadedAt: new Date().toISOString(),
            uploadedBy: req.user?.id || 'system'
        };

        // Add attachment to project
        if (!project.attachments) {
            project.attachments = [];
        }
        project.attachments.push(attachment);

        // Update project in database
        projectData.updateItem(projectId, { attachments: project.attachments });

        res.status(201).json(attachment);
    } catch (error) {
        logger.error('Error uploading project attachment:', error);
        res.status(500).json({ message: error.message });
    }
}

function getProjectAttachments(req, res) {
    try {
        const projectId = req.params.projectId;
        
        // Check if project exists
        const project = projectData.getItemById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const attachments = project.attachments || [];
        res.json(attachments);
    } catch (error) {
        logger.error('Error getting project attachments:', error);
        res.status(500).json({ message: error.message });
    }
}

function deleteProjectAttachment(req, res) {
    try {
        const projectId = req.params.projectId;
        const attachmentId = req.params.attachmentId;
        
        // Check if project exists
        const project = projectData.getItemById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        if (!project.attachments) {
            return res.status(404).json({ message: 'No attachments found' });
        }

        // Find and remove attachment
        const attachmentIndex = project.attachments.findIndex(att => att._id === attachmentId);
        if (attachmentIndex === -1) {
            return res.status(404).json({ message: 'Attachment not found' });
        }

        const attachment = project.attachments[attachmentIndex];
        
        // Delete file from filesystem
        const filePath = path.join(MEDIA_ROOT, 'attachments/projects', projectId, attachment.name);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // Remove attachment from project
        project.attachments.splice(attachmentIndex, 1);
        projectData.updateItem(projectId, { attachments: project.attachments });

        res.json({ message: 'Attachment deleted successfully' });
    } catch (error) {
        logger.error('Error deleting project attachment:', error);
        res.status(500).json({ message: error.message });
    }
}

// Controller for deleting an internal attachment
async function deleteInternalAttachment(req, res) {
    try {
        const projectId = req.params.id;
        const attachmentId = req.params.attachmentId;

        const project = projectData.getItemById(projectId);
        if (!project) {
            return res.status(404).json({ message: 'Project not found' });
        }

        const attachments = project.internalAttachments || [];
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
        const updatedProject = projectData.updateItem(projectId, { 
            internalAttachments: updatedAttachments 
        });

        if (updatedProject) {
            return res.json(updatedProject);
        } else {
            return res.status(500).json({ message: 'Failed to update project' });
        }
    } catch (error) {
        logger.error('Error deleting internal attachment', error);
        return res.status(500).json({ message: 'Failed to delete internal attachment' });
    }
}

module.exports = {
    getAllProjects,
    getProjectById,
    getProjectByDeveloper,
    getProjectByDeveloperTag,
    getProjectByTag,
    addProject,
    updateProject,
    deleteProject,
    getProjectsByDeveloper,
    getAvailableProjectsForSalesOrder,
    uploadProjectAttachment,
    getProjectAttachments,
    deleteProjectAttachment,
    deleteInternalAttachment
};
