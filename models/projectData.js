const DataModel = require('./DataModel');

class ProjectData extends DataModel {
    constructor() {
        super('projects');
    }

    // Get projects by developer ID
    getItemsByDeveloper(developerId) {
        return this.getProjectByDeveloperId(developerId);
    }
}

const projectData = new ProjectData();

module.exports = projectData;
