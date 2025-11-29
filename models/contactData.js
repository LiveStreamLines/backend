const DataModel = require('./DataModel');

class ContactData extends DataModel {
    constructor() {
        super('contacts');
    }

    // Get contacts by developer ID
    getContactsByDeveloper(developerId) {
        const data = this.readData();
        return data.filter(item => item.developerId === developerId && !item.projectId && !item.cameraId);
    }

    // Get contacts by project ID
    getContactsByProject(projectId) {
        const data = this.readData();
        return data.filter(item => item.projectId === projectId && !item.cameraId);
    }

    // Get contacts by camera ID
    getContactsByCamera(cameraId) {
        const data = this.readData();
        return data.filter(item => item.cameraId === cameraId);
    }

    // Get all contacts for a developer (including projects and cameras)
    getAllContactsByDeveloper(developerId) {
        const data = this.readData();
        return data.filter(item => item.developerId === developerId);
    }
}

const contactData = new ContactData();

module.exports = contactData;

