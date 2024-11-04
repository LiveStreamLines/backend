const DataModel = require('./DataModel');

class DeveloperData extends DataModel {
    constructor() {
      super('developers'); // Assuming 'developers' is the table/collection name
    }
  
    // Method to add a new developer
    async addItem(developerData) {
      return await this.addItem(developerData);
    }
  
    // Method to update developer data
    async updateItem(developerId, updatedData) {
      return await this.updateItem(developerId, updatedData);
    }
  }


module.exports = new DeveloperData();
