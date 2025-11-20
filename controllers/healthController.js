// controllers/healthController.js
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const MemoryData = require('../models/memoryData');
const cameraData = require('../models/cameraData');
const developerData = require('../models/developerData');
const projectData = require('../models/projectData');
const cameraStatusHistoryController = require('./cameraStatusHistoryController');

// Define the root directory for camera pictures
const mediaRoot = process.env.MEDIA_PATH + '/upload';

function healthCheck(req, res) {
  try {
    const healthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      service: 'local-backend'
    };

    logger.info('Health check requested');
    res.status(200).json(healthData);
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
}

function cameraHealth(req, res) {
  try {
    const { developerId, projectId, cameraId } = req.params;

    if (!developerId || !projectId || !cameraId) {
      return res.status(400).json({ 
        error: 'Missing required parameters: developerId, projectId, cameraId' 
      });
    }

    const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');

    // Check if the camera directory exists
    if (!fs.existsSync(cameraPath)) {
      return res.status(404).json({ 
        error: 'Camera directory not found',
        developerId,
        projectId,
        cameraId
      });
    }

    // Read all image files in the camera directory
    const files = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));

    if (files.length === 0) {
      return res.status(200).json({
        developerId,
        projectId,
        cameraId,
        firstDay: { date: null, count: 0 },
        secondDay: { date: null, count: 0 },
        thirdDay: { date: null, count: 0 },
        message: 'No pictures found in camera directory'
      });
    }

    // Calculate the last 3 days starting from yesterday (excluding today)
    // First day: yesterday, Second day: 2 days ago, Third day: 3 days ago
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Format dates as YYYYMMDD
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return year + month + day;
    };

    const yesterdayStr = formatDate(yesterday);
    const twoDaysAgoStr = formatDate(twoDaysAgo);
    const threeDaysAgoStr = formatDate(threeDaysAgo);

    // Count images for each day (from 00:00:00 to 23:59:59)
    const countImagesForDay = (dayStr) => {
      const startTimestamp = dayStr + '000000'; // YYYYMMDD000000
      const endTimestamp = dayStr + '235959';   // YYYYMMDD235959

      return files.filter(file => {
        const fileTimestamp = file.replace('.jpg', '');
        return fileTimestamp >= startTimestamp && fileTimestamp <= endTimestamp;
      }).length;
    };

    const firstDayCount = countImagesForDay(yesterdayStr);
    const secondDayCount = countImagesForDay(twoDaysAgoStr);
    const thirdDayCount = countImagesForDay(threeDaysAgoStr);

    // Format date for display (YYYY-MM-DD)
    const formatDateDisplay = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    logger.info(`Camera health check for developerId: ${developerId}, projectId: ${projectId}, cameraId: ${cameraId}`);

    // Check if there's an assigned memory for this camera
    // The parameters are actually tags/names, not IDs
    const memories = MemoryData.findMemory(developerId, projectId, cameraId);
    const memory = memories && memories.length > 0 ? memories[0] : null;
    
    const response = {
      developerId,
      projectId,
      cameraId,
      firstDay: {
        date: formatDateDisplay(yesterday),
        count: firstDayCount
      },
      secondDay: {
        date: formatDateDisplay(twoDaysAgo),
        count: secondDayCount
      },
      thirdDay: {
        date: formatDateDisplay(threeDaysAgo),
        count: thirdDayCount
      },
      totalImages: firstDayCount + secondDayCount + thirdDayCount
    };

    // Include memory information if memory is assigned
    if (memory) {
      response.hasMemoryAssigned = true;
      response.memoryAvailable = memory.memoryAvailable || null;
    } else {
      response.hasMemoryAssigned = false;
      response.memoryAvailable = null;
    }

    // Automatically update lowImages status based on yesterday's image count
    // If yesterday's count < 40, set lowImages = true, otherwise set it to false
    try {
      const cameras = cameraData.getAllItems();
      const developers = developerData.getAllItems();
      const projects = projectData.getAllItems();

      // Find camera by matching developer tag, project tag, and camera name
      const camera = cameras.find(cam => {
        const dev = developers.find(d => d._id === cam.developer);
        const proj = projects.find(p => p._id === cam.project);
        if (!dev || !proj) return false;
        
        const devTagMatch = (dev.developerTag || '').toString().trim().toLowerCase() === developerId.toLowerCase();
        const projTagMatch = (proj.projectTag || '').toString().trim().toLowerCase() === projectId.toLowerCase();
        const cameraNameMatch = (cam.camera || '').toString().trim().toLowerCase() === cameraId.toLowerCase();
        
        return devTagMatch && projTagMatch && cameraNameMatch;
      });

      if (camera) {
        const currentStatus = camera.maintenanceStatus || {};
        const shouldBeLowImages = firstDayCount < 40;
        const currentlyLowImages = !!currentStatus.lowImages;

        // Only update if the status needs to change
        if (shouldBeLowImages !== currentlyLowImages) {
          const nextStatus = { ...currentStatus };
          const now = new Date().toISOString();
          
          if (shouldBeLowImages) {
            // Marking as low images - set the marking date only if not already set
            nextStatus.lowImages = true;
            if (!nextStatus.lowImagesMarkedAt) {
              nextStatus.lowImagesMarkedBy = 'System';
              nextStatus.lowImagesMarkedAt = now;
            }
            // Clear removal tracking when marking
            nextStatus.lowImagesRemovedBy = undefined;
            nextStatus.lowImagesRemovedAt = undefined;
          } else {
            // Clearing low images - track who cleared and when
            nextStatus.lowImages = false;
            nextStatus.lowImagesRemovedBy = 'System';
            nextStatus.lowImagesRemovedAt = now;
            // Keep the original marking info for history
          }

          // Update the camera
          cameraData.updateItem(camera._id, { maintenanceStatus: nextStatus });

          // Log the status change in history
          cameraStatusHistoryController.recordStatusChange({
            cameraId: camera._id,
            cameraName: camera.camera,
            developerId: camera.developer,
            projectId: camera.project,
            statusType: 'lowImages',
            action: shouldBeLowImages ? 'on' : 'off',
            performedBy: 'System',
            performedByEmail: 'system@auto',
            performedAt: now,
          });

          logger.info(`Auto-updated lowImages status for camera ${camera.camera}: ${shouldBeLowImages ? 'ON' : 'OFF'} (yesterday's count: ${firstDayCount})`);
        }
      }
    } catch (updateError) {
      // Log error but don't fail the health check
      logger.error('Error auto-updating lowImages status:', updateError);
    }

    res.status(200).json(response);
  } catch (error) {
    logger.error('Camera health check error:', error);
    res.status(500).json({
      error: 'Camera health check failed',
      message: error.message
    });
  }
}

module.exports = {
  healthCheck,
  cameraHealth
};

