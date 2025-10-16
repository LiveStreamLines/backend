const projectData = require('../models/projectData');
const developerData = require('../models/developerData'); // To validate developer selection
const path = require('path');
const fs = require('fs');
const logger = require('../logger');
const salesOrderData = require('../models/salesOrderData');
const multer = require('multer');
const DataModel = require('../models/DataModel');

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
function addProject(req, res) {
    const newProject = req.body;

    // Check if developer exists
    const developer = developerData.getItemById(newProject.developer);
    if (!developer) {
        return res.status(400).json({ message: 'Invalid developer ID' });
    }

    const addedProject = projectData.addItem(newProject);

    if (req.file) {
        const imageFileName = `${addedProject._id}${path.extname(req.file.originalname)}`;
        const imageFilePath = path.join(process.env.MEDIA_PATH, 'logos/project/', imageFileName);

        fs.rename(req.file.path, imageFilePath, (err) => {
            if (err) {
                logger.error('Error saving file:', err);
                return res.status(500).json({ message: 'Failed to save file' });
            }
            const final = projectData.updateItem(addedProject._id, { logo: `logos/project/${imageFileName}` });
            return res.status(201).json(final);
        });
    } else {
        const final = projectData.updateItem(addedProject._id, { logo: `` });
        return res.status(201).json(final);
    }
}

// Controller for updating a Project
function updateProject(req, res) {
    const updatedData = req.body;
    const projectId = req.params.id;

    // Check if developer exists
    if (updatedData.developerId) {
        const developer = developerData.getItemById(updatedData.developerId);
        if (!developer) {
            return res.status(400).json({ message: 'Invalid developer ID' });
        }
    }

    const updatedProject = projectData.updateItem(projectId, updatedData);

    if (updatedProject) {
        if (req.file) {
            const imageFileName = `${projectId}${path.extname(req.file.originalname)}`;
            projectData.updateItem(projectId, { logo: `logos/project/${imageFileName}` });
        }
        res.json(updatedProject);
    } else {
        res.status(404).json({ message: 'Project not found' });
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
            url: `${getAttachmentBaseUrl()}/media/attachments/projects/${projectId}/${file.filename}`,
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
        const filePath = path.join(process.env.MEDIA_PATH, 'attachments/projects', projectId, attachment.name);
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
    deleteProjectAttachment
};
