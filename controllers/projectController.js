const projectData = require('../data/projectData');

// Controller for getting all Projects
function getAllProjects(req, res) {
    const projects = projectData.getAllItems();
    res.json(projects);
}

// Controller for getting a single Project by ID
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


// Controller for adding a new Project
function addProject(req, res) {
    const newProject = req.body;
    const addedProject = projectData.addItem(newProject);
    res.status(201).json(addedProject);
}

// Controller for updating a Project
function updateProject(req, res) {
    const updatedProject = projectData.updateItem(req.params.id, req.body);
    if (updatedProject) {
        res.json(updatedProject);
    } else {
        res.status(404).json({ message: 'Project not found' });
    }
}

// Controller for deleting a Project
function deleteProject(req, res) {
    const isDeleted = projectData.deleteItem(req.params._id);
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
    addProject,
    updateProject,
    deleteProject
};
