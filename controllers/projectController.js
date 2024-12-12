const projectData = require('../models/projectData');
const developerData = require('../models/developerData'); // To validate developer selection
const path = require('path');
const fs = require('fs');

/// Controller for getting all projects
function getAllProjects(req, res) {
    const projects = projectData.getAllItems();
    res.json(projects);
}

// Controller for getting a single project by ID
function getProjectById(req, res) {
    const project = projectData.getItemById(req.params.id);
    if (project) {
        res.json(project);
    } else {
        res.status(404).json({ message: 'Project not found' });
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

// Controller for getting projects in Developer
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
                console.error('Error saving file:', err);
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
    const isDeleted = projectData.deleteItem(req.params.id);
    if (isDeleted) {
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'Project not found' });
    }
}

module.exports = {
    getAllProjects,
    getProjectById,
    getProjectByDeveloper,
    getProjectByTag,
    addProject,
    updateProject,
    deleteProject
};
