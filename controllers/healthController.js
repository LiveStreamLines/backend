// controllers/healthController.js
const fs = require('fs');
const path = require('path');
const logger = require('../logger');
const MemoryData = require('../models/memoryData');
const cameraData = require('../models/cameraData');
const developerData = require('../models/developerData');
const projectData = require('../models/projectData');
const inventoryData = require('../models/inventoryData');
const deviceTypeData = require('../models/deviceTypeData');
const cameraStatusHistoryController = require('./cameraStatusHistoryController');

// Define the root directory for camera pictures
const mediaRoot = process.env.MEDIA_PATH + '/upload';

// Helper function to calculate validity left for an inventory item
function calculateValidityLeft(inventoryItem, deviceTypes) {
  // Get total validity days from device type or item
  let totalValidity = null;
  
  const deviceTypeName = inventoryItem.device?.type?.trim().toLowerCase();
  if (deviceTypeName) {
    const deviceType = deviceTypes.find(dt => {
      const dtName = (dt.name || '').trim().toLowerCase();
      return dtName === deviceTypeName;
    });
    if (deviceType && deviceType.validityDays) {
      totalValidity = parseInt(deviceType.validityDays, 10);
    }
  }
  
  // Fallback to item's validityDays
  if (totalValidity === null && inventoryItem.validityDays) {
    totalValidity = parseInt(inventoryItem.validityDays, 10);
  }
  
  if (totalValidity === null || totalValidity <= 0 || isNaN(totalValidity)) {
    return null; // Cannot calculate
  }
  
  // Calculate age in days
  let ageInDays = 0;
  
  // Add estimated age if present
  if (inventoryItem.estimatedAge) {
    const estimatedAge = parseInt(inventoryItem.estimatedAge, 10);
    if (!isNaN(estimatedAge) && estimatedAge > 0) {
      ageInDays += estimatedAge;
    }
  }
  
  // Calculate from assignment date
  if (inventoryItem.currentAssignment?.assignedDate) {
    const assignedDate = new Date(inventoryItem.currentAssignment.assignedDate);
    const now = new Date();
    if (!isNaN(assignedDate.getTime())) {
      const daysSinceAssignment = Math.floor((now - assignedDate) / (1000 * 60 * 60 * 24));
      ageInDays += daysSinceAssignment;
    }
  }
  
  // Calculate from created date if no assignment
  if (!inventoryItem.currentAssignment && inventoryItem.createdDate) {
    const createdDate = new Date(inventoryItem.createdDate);
    const now = new Date();
    if (!isNaN(createdDate.getTime())) {
      const daysSinceCreation = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
      ageInDays += daysSinceCreation;
    }
  }
  
  return totalValidity - ageInDays;
}

// Helper function to get inventory items assigned to a camera
function getInventoryItemsByCamera(cameraId, cameraName, developerId, projectId) {
  const allItems = inventoryData.getAllItems();
  
  return allItems.filter(item => {
    // Check assignedCameraId
    if (item.assignedCameraId === cameraId) {
      return true;
    }
    
    // Check currentAssignment.camera (could be ID or name)
    if (item.currentAssignment?.camera) {
      const assignmentCamera = item.currentAssignment.camera;
      // If it's a string and matches camera name (not an ObjectId)
      if (typeof assignmentCamera === 'string') {
        // Check if it's an ObjectId (24 hex characters)
        const isObjectId = /^[a-f0-9]{24}$/i.test(assignmentCamera);
        if (isObjectId && assignmentCamera === cameraId) {
          return true;
        }
        if (!isObjectId && assignmentCamera.toLowerCase() === cameraName.toLowerCase()) {
          return true;
        }
      }
    }
    
    // Check assignedCameraName
    if (item.assignedCameraName && 
        item.assignedCameraName.toLowerCase() === cameraName.toLowerCase()) {
      return true;
    }
    
    return false;
  });
}

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

    // Check for images with wrong time (images starting with "2000")
    const hasWrongTime = files.some(file => {
      const fileTimestamp = file.replace('.jpg', '');
      return fileTimestamp.startsWith('2000');
    });

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
    // Note: findMemory already filters for status === 'active'
    const memories = MemoryData.findMemory(developerId, projectId, cameraId);
    const memory = memories && memories.length > 0 ? memories[0] : null;
    
    // Include memory information if memory is assigned and active
    let shutterCount = null;
    let hasMemoryAssigned = false;
    let memoryAvailable = null;
    
    // Only process if memory exists and is active (findMemory already filters for active, but double-check for safety)
    if (memory && memory.status === 'active') {
      hasMemoryAssigned = true;
      memoryAvailable = memory.memoryAvailable || null;
      // Get shutter count from memory (check both field names)
      const rawShutterCount = memory.shuttercount ?? memory.shutterCount ?? null;
      // Convert to number if it's a string or number
      if (rawShutterCount !== null && rawShutterCount !== undefined) {
        if (typeof rawShutterCount === 'number') {
          shutterCount = rawShutterCount;
        } else if (typeof rawShutterCount === 'string') {
          // Remove commas and other formatting characters before parsing
          const cleaned = rawShutterCount.replace(/[,.\s]/g, '');
          const parsed = parseInt(cleaned, 10);
          shutterCount = isNaN(parsed) ? null : parsed;
        }
      }
    }
    
    // Check if shutter count exceeds 10,000 (shutter expiry) - only for active memories
    const hasShutterExpiry = memory && memory.status === 'active' && shutterCount !== null && shutterCount > 10000;
    
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
      totalImages: firstDayCount + secondDayCount + thirdDayCount,
      hasWrongTime: hasWrongTime,
      hasShutterExpiry: hasShutterExpiry,
      hasMemoryAssigned: hasMemoryAssigned,
      memoryAvailable: memoryAvailable,
      shutterCount: shutterCount,
      hasDeviceExpired: false // Will be calculated below
    };

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

      if (!camera) {
        logger.warn(`Camera not found for health check: developerId=${developerId}, projectId=${projectId}, cameraId=${cameraId}`);
      }

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

        // Automatically update wrongTime status based on images starting with "2000"
        const currentlyWrongTime = !!currentStatus.wrongTime;
        if (hasWrongTime !== currentlyWrongTime) {
          const nextStatus = { ...currentStatus };
          const now = new Date().toISOString();
          
          if (hasWrongTime) {
            // Marking as wrong time - set the marking date only if not already set
            nextStatus.wrongTime = true;
            if (!nextStatus.wrongTimeMarkedAt) {
              nextStatus.wrongTimeMarkedBy = 'System';
              nextStatus.wrongTimeMarkedAt = now;
            }
            // Clear removal tracking when marking
            nextStatus.wrongTimeRemovedBy = undefined;
            nextStatus.wrongTimeRemovedAt = undefined;
          } else {
            // Clearing wrong time - track who cleared and when
            nextStatus.wrongTime = false;
            nextStatus.wrongTimeRemovedBy = 'System';
            nextStatus.wrongTimeRemovedAt = now;
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
            statusType: 'wrongTime',
            action: hasWrongTime ? 'on' : 'off',
            performedBy: 'System',
            performedByEmail: 'system@auto',
            performedAt: now,
          });

          logger.info(`Auto-updated wrongTime status for camera ${camera.camera}: ${hasWrongTime ? 'ON' : 'OFF'}`);
        }

        // Automatically update shutterExpiry status based on shutter count > 10000
        const currentlyShutterExpiry = !!currentStatus.shutterExpiry;
        
        // Log debug info for shutter expiry check
        if (memory) {
          logger.info(`Shutter expiry check for camera ${camera.camera}: shutterCount=${shutterCount}, hasShutterExpiry=${hasShutterExpiry}, currentlyShutterExpiry=${currentlyShutterExpiry}, memory.shuttercount=${memory.shuttercount}, memory.shutterCount=${memory.shutterCount}`);
        } else {
          logger.info(`Shutter expiry check for camera ${camera.camera}: No memory found, shutterCount=${shutterCount}`);
        }
        
        if (hasShutterExpiry !== currentlyShutterExpiry) {
          const nextStatus = { ...currentStatus };
          const now = new Date().toISOString();
          
          if (hasShutterExpiry) {
            // Marking as shutter expiry - set the marking date only if not already set
            nextStatus.shutterExpiry = true;
            if (!nextStatus.shutterExpiryMarkedAt) {
              nextStatus.shutterExpiryMarkedBy = 'System';
              nextStatus.shutterExpiryMarkedAt = now;
            }
            // Clear removal tracking when marking
            nextStatus.shutterExpiryRemovedBy = undefined;
            nextStatus.shutterExpiryRemovedAt = undefined;
          } else {
            // Clearing shutter expiry - track who cleared and when
            nextStatus.shutterExpiry = false;
            nextStatus.shutterExpiryRemovedBy = 'System';
            nextStatus.shutterExpiryRemovedAt = now;
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
            statusType: 'shutterExpiry',
            action: hasShutterExpiry ? 'on' : 'off',
            performedBy: 'System',
            performedByEmail: 'system@auto',
            performedAt: now,
          });

          logger.info(`Auto-updated shutterExpiry status for camera ${camera.camera}: ${hasShutterExpiry ? 'ON' : 'OFF'} (shutter count: ${shutterCount}, memory: ${memory ? 'found' : 'not found'})`);
        }

        // Automatically update deviceExpiry status based on assigned inventory items
        const inventoryItems = getInventoryItemsByCamera(
          camera._id, 
          camera.camera, 
          developerId, 
          projectId
        );
        const deviceTypes = deviceTypeData.getAllItems();

        let hasDeviceExpired = false;
        if (inventoryItems.length > 0) {
          // Check if any assigned device has validityLeft <= 0
          for (const item of inventoryItems) {
            const validityLeft = calculateValidityLeft(item, deviceTypes);
            if (validityLeft !== null && validityLeft <= 0) {
              hasDeviceExpired = true;
              logger.info(`Device expiry detected for camera ${camera.camera}: item ${item._id} has validityLeft=${validityLeft}`);
              break;
            }
          }
        }

        const currentlyDeviceExpiry = !!currentStatus.deviceExpiry;

        if (hasDeviceExpired !== currentlyDeviceExpiry) {
          const nextStatus = { ...currentStatus };
          const now = new Date().toISOString();
          
          if (hasDeviceExpired) {
            // Marking as device expiry - set the marking date only if not already set
            nextStatus.deviceExpiry = true;
            if (!nextStatus.deviceExpiryMarkedAt) {
              nextStatus.deviceExpiryMarkedBy = 'System';
              nextStatus.deviceExpiryMarkedAt = now;
            }
            // Clear removal tracking when marking
            nextStatus.deviceExpiryRemovedBy = undefined;
            nextStatus.deviceExpiryRemovedAt = undefined;
          } else {
            // Clearing device expiry - track who cleared and when
            nextStatus.deviceExpiry = false;
            nextStatus.deviceExpiryRemovedBy = 'System';
            nextStatus.deviceExpiryRemovedAt = now;
          }

          // Update the camera
          cameraData.updateItem(camera._id, { maintenanceStatus: nextStatus });

          // Log the status change in history
          cameraStatusHistoryController.recordStatusChange({
            cameraId: camera._id,
            cameraName: camera.camera,
            developerId: camera.developer,
            projectId: camera.project,
            statusType: 'deviceExpiry',
            action: hasDeviceExpired ? 'on' : 'off',
            performedBy: 'System',
            performedByEmail: 'system@auto',
            performedAt: now,
          });

          logger.info(`Auto-updated deviceExpiry status for camera ${camera.camera}: ${hasDeviceExpired ? 'ON' : 'OFF'} (inventory items checked: ${inventoryItems.length})`);
        }

        // Update response with device expiry status
        response.hasDeviceExpired = hasDeviceExpired;
      }
    } catch (updateError) {
      // Log error but don't fail the health check
      logger.error('Error auto-updating camera status:', updateError);
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

