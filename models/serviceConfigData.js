const fs = require('fs');
const path = require('path');

class ServiceConfigData {
    constructor() {
        this.filePath = path.join(__dirname, '../data/serviceConfig.json');
    }

    // Read configuration from JSON file
    getConfig() {
        if (!fs.existsSync(this.filePath)) {
            return {
                allowedTags: [],
                allowedSite: [],
                allowedDrone: []
            };
        }
        const data = fs.readFileSync(this.filePath, 'utf8');
        return JSON.parse(data);
    }

    // Update configuration
    updateConfig(config) {
        fs.writeFileSync(this.filePath, JSON.stringify(config, null, 2));
        return this.getConfig();
    }
}

module.exports = new ServiceConfigData();

