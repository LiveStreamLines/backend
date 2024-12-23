const fs = require('fs');
const path = require('path');

class DataModel {
    constructor(modelName) {
        this.filePath = path.join(__dirname, '../data', `${modelName}.json`);
    }

    // Helper function to read data from JSON file
    readData() {
        if (!fs.existsSync(this.filePath)) {
            return [this.filePath];
        }
        const data = fs.readFileSync(this.filePath);
        return JSON.parse(data);
    }

    // Helper function to write data to JSON file
    writeData(data) {
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    // Generate a MongoDB-like ObjectID
    generateCustomId() {
        return Array.from(Array(24), () => Math.floor(Math.random() * 16).toString(16)).join('');
    }

    // Get All Items
    getAllItems() {
        return this.readData();
    }

    // Get Item by ID
    getItemById(id) {
        const items = this.readData();
        return items.find(item => item._id === id);
    }

    // Add a New Item
    addItem(item) {
        const items = this.readData();
        const id = this.generateCustomId();
        const newItem = {
            _id: id,
            ...item,
            isActive: true,
            createdDate: new Date().toISOString()
        };
        items.push(newItem);
        this.writeData(items);
        return newItem;
    }

    // Update an Existing Item
    updateItem(id, updateData) {
        const items = this.readData();
        const index = items.findIndex(item => item._id === id);

        if (index !== -1) {
            items[index] = { ...items[index], ...updateData };
            this.writeData(items);
            return items[index];
        }
        return null;
    }

    // Delete an Item
    deleteItem(id) {
        const items = this.readData();
        const updatedItems = items.filter(item => item._id !== id);

        if (items.length !== updatedItems.length) {
            this.writeData(updatedItems);
            return true;
        }
        return false;
    }

    // New Method: Get Items by Developer ID (specific to projects)
    getProjectByDeveloperId(developerId) {
        const data = this.readData();
        return data.filter(item => item.developer === developerId);
    }

     // New Method: Get Items by Project ID (specific to Cameras)
     getCameraByProjectId(projectId) {
        const data = this.readData();
        return data.filter(item => item.project === projectId);
    }

    findUserByEmailAndPassword(email, password) {
        const data = this.readData();
        return data.find(user => user.email === email && user.password === password);
    }

    findUserByPhone(phone) {
        const data = this.readData();
        return data.find(user => user.phone === phone);
    }

    getRequestByDeveloperTag(tag){
        const data = this.readData();
        return data.filter(item => item.developer === tag)
    }

    getDeveloperByTag(tag) {
        const data = this.readData();
        return data.filter(item => item.developerTag === tag);
    }

    getProjectByTag(tag) {
        const data = this.readData();
        return data.filter(item => item.projectTag === tag);
    }

    getUserByEmail(email) {
        const data = this.readData();
        return data.filter(item => item.email === email);
    }

    getUserByToken(token) {
        const data = this.readData();
        return data.filter(item => item.resetPasswordToken === token);
    }

}

module.exports = DataModel;
