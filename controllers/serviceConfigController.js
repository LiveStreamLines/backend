const serviceConfigData = require('../models/serviceConfigData');
const logger = require('../logger');

// Controller for getting service configuration (allowedTags, allowedSite, allowedDrone)
function getServiceConfig(req, res) {
    try {
        const config = serviceConfigData.getConfig();
        res.json(config);
    } catch (error) {
        logger.error('Error getting service config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

// Controller for updating service configuration
function updateServiceConfig(req, res) {
    try {
        const { allowedTags, allowedSite, allowedDrone } = req.body;
        
        if (!allowedTags || !allowedSite || !allowedDrone) {
            return res.status(400).json({ 
                success: false, 
                message: 'allowedTags, allowedSite, and allowedDrone are required' 
            });
        }

        const updatedConfig = serviceConfigData.updateConfig({
            allowedTags,
            allowedSite,
            allowedDrone
        });

        res.json({ success: true, data: updatedConfig });
    } catch (error) {
        logger.error('Error updating service config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
}

module.exports = {
    getServiceConfig,
    updateServiceConfig
};

