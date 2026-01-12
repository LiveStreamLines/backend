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
//const mediaRoot = process.env.MEDIA_PATH + '/upload';
const mediaRoot = "/var/media/upload";
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
  let hasRange = false;
  
  // Add estimated age if present
  if (inventoryItem.estimatedAge) {
    const estimatedAge = parseInt(inventoryItem.estimatedAge, 10);
    if (!isNaN(estimatedAge) && estimatedAge > 0) {
      ageInDays += estimatedAge;
      hasRange = true;
    }
  }
  
  // Helper function to calculate duration between dates
  const calculateDuration = (start, end) => {
    if (!start) return 0;
    const startDate = new Date(start);
    if (isNaN(startDate.getTime())) return 0;
    const endDate = end ? new Date(end) : new Date();
    if (isNaN(endDate.getTime())) return 0;
    const milliseconds = endDate.getTime() - startDate.getTime();
    if (milliseconds <= 0) return 0;
    return Math.floor(milliseconds / (1000 * 60 * 60 * 24));
  };
  
  // Calculate from current assignment date
  if (inventoryItem.currentAssignment?.assignedDate) {
    const duration = calculateDuration(
      inventoryItem.currentAssignment.assignedDate,
      inventoryItem.currentAssignment.removedDate
    );
    if (duration > 0) {
      ageInDays += duration;
      hasRange = true;
    }
  }
  
  // Calculate from assignment history (previous assignments)
  if (inventoryItem.assignmentHistory && Array.isArray(inventoryItem.assignmentHistory)) {
    for (const assignment of inventoryItem.assignmentHistory) {
      const duration = calculateDuration(assignment.assignedDate, assignment.removedDate);
      if (duration > 0) {
        ageInDays += duration;
        hasRange = true;
      }
    }
  }
  
  // Calculate from created date if no assignment history
  if (!hasRange && inventoryItem.createdDate) {
    const duration = calculateDuration(inventoryItem.createdDate, null);
    if (duration > 0) {
      ageInDays += duration;
      hasRange = true;
    }
  }
  
  // If we couldn't calculate age, return null
  if (!hasRange) {
    return null;
  }
  
  return totalValidity - ageInDays;
}

// Helper function to get inventory items assigned to a camera
function getInventoryItemsByCamera(cameraId, cameraName, developerId, projectId) {
  const allItems = inventoryData.getAllItems();
  
  const matchedItems = allItems.filter(item => {
    // Only check items that are assigned (status === 'assigned')
    // Items with status 'available' or 'user_assigned' are not assigned to cameras
    if (item.status !== 'assigned') {
      return false;
    }
    
    // Check if item has currentAssignment (modern assignment structure)
    if (item.currentAssignment) {
      const assignment = item.currentAssignment;
      
      // Check if assignment matches the camera's developer and project
      const assignmentDeveloperId = typeof assignment.developer === 'object' 
        ? assignment.developer._id 
        : assignment.developer;
      const assignmentProjectId = typeof assignment.project === 'object' 
        ? assignment.project._id 
        : assignment.project;
      
      // Developer and project must match
      if (assignmentDeveloperId !== developerId || assignmentProjectId !== projectId) {
        return false;
      }
      
      // Check if camera matches
      if (assignment.camera) {
        const assignmentCamera = assignment.camera;
        
        // If camera is an object with _id
        if (typeof assignmentCamera === 'object' && assignmentCamera._id) {
          if (assignmentCamera._id === cameraId) {
            return true;
          }
        }
        
        // If camera is a string
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
      } else {
        // If assignment exists but no camera field, check if developer/project match
        // This handles cases where camera might not be explicitly set but item is assigned to the project
        // However, we should only match if camera is explicitly set, so return false here
        return false;
      }
    }
    
    // Legacy support: Check assignedCameraId (for items without currentAssignment)
    if (item.assignedCameraId === cameraId) {
      return true;
    }
    
    // Legacy support: Check assignedCameraName (for items without currentAssignment)
    if (item.assignedCameraName && 
        item.assignedCameraName.toLowerCase() === cameraName.toLowerCase()) {
      return true;
    }
    
    return false;
  });
  
  // Log for debugging
  if (matchedItems.length === 0) {
    logger.debug(`getInventoryItemsByCamera: No items found for camera ${cameraName} (ID: ${cameraId}), Developer: ${developerId}, Project: ${projectId}`);
  } else {
    logger.debug(`getInventoryItemsByCamera: Found ${matchedItems.length} items for camera ${cameraName} (ID: ${cameraId})`);
  }
  
  return matchedItems;
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
        // Get current status from history instead of camera.maintenanceStatus
        const currentStatusFromHistory = cameraStatusHistoryController.getCurrentStatusFromHistory(camera._id);
        const shouldBeLowImages = firstDayCount < 40;
        const currentlyLowImages = currentStatusFromHistory.lowImages;

        // Only update if the status needs to change
        if (shouldBeLowImages !== currentlyLowImages) {
          const now = new Date().toISOString();
          
          if (shouldBeLowImages) {
            // Marking as low images - only log if not already marked
            if (!currentlyLowImages) {
              // Log the status change in history
              cameraStatusHistoryController.recordStatusChange({
                cameraId: camera._id,
                cameraName: camera.camera,
                developerId: camera.developer,
                projectId: camera.project,
                statusType: 'lowImages',
                action: 'on',
                performedBy: 'System',
                performedByEmail: 'system@auto',
                performedAt: now,
              });

              logger.info(`Auto-updated lowImages status for camera ${camera.camera}: ON (yesterday's count: ${firstDayCount})`);
            }
          } else {
            // Clearing low images - only log removal if it was previously marked
            if (currentlyLowImages) {
              // Log the status change in history
              cameraStatusHistoryController.recordStatusChange({
                cameraId: camera._id,
                cameraName: camera.camera,
                developerId: camera.developer,
                projectId: camera.project,
                statusType: 'lowImages',
                action: 'off',
                performedBy: 'System',
                performedByEmail: 'system@auto',
                performedAt: now,
              });

              logger.info(`Auto-updated lowImages status for camera ${camera.camera}: OFF (yesterday's count: ${firstDayCount})`);
            }
          }
        }

        // Automatically update wrongTime status based on images starting with "2000"
        const currentlyWrongTime = currentStatusFromHistory.wrongTime;
        if (hasWrongTime !== currentlyWrongTime) {
          const now = new Date().toISOString();
          
          if (hasWrongTime) {
            // Marking as wrong time - only log if not already marked
            if (!currentlyWrongTime) {
              // Log the status change in history
              cameraStatusHistoryController.recordStatusChange({
                cameraId: camera._id,
                cameraName: camera.camera,
                developerId: camera.developer,
                projectId: camera.project,
                statusType: 'wrongTime',
                action: 'on',
                performedBy: 'System',
                performedByEmail: 'system@auto',
                performedAt: now,
              });

              logger.info(`Auto-updated wrongTime status for camera ${camera.camera}: ON`);
            }
          } else {
            // Clearing wrong time - only log removal if it was previously marked
            if (currentlyWrongTime) {
              // Log the status change in history
              cameraStatusHistoryController.recordStatusChange({
                cameraId: camera._id,
                cameraName: camera.camera,
                developerId: camera.developer,
                projectId: camera.project,
                statusType: 'wrongTime',
                action: 'off',
                performedBy: 'System',
                performedByEmail: 'system@auto',
                performedAt: now,
              });

              logger.info(`Auto-updated wrongTime status for camera ${camera.camera}: OFF`);
            }
          }
        }

        // Automatically update shutterExpiry status based on shutter count > 10000
        const currentlyShutterExpiry = currentStatusFromHistory.shutterExpiry;
        
        // Log debug info for shutter expiry check
        if (memory) {
          logger.info(`Shutter expiry check for camera ${camera.camera}: shutterCount=${shutterCount}, hasShutterExpiry=${hasShutterExpiry}, currentlyShutterExpiry=${currentlyShutterExpiry}, memory.shuttercount=${memory.shuttercount}, memory.shutterCount=${memory.shutterCount}`);
        } else {
          logger.info(`Shutter expiry check for camera ${camera.camera}: No memory found, shutterCount=${shutterCount}`);
        }
        
        if (hasShutterExpiry !== currentlyShutterExpiry) {
          const now = new Date().toISOString();
          
          if (hasShutterExpiry) {
            // Marking as shutter expiry - only log if not already marked
            if (!currentlyShutterExpiry) {
              // Log the status change in history
              cameraStatusHistoryController.recordStatusChange({
                cameraId: camera._id,
                cameraName: camera.camera,
                developerId: camera.developer,
                projectId: camera.project,
                statusType: 'shutterExpiry',
                action: 'on',
                performedBy: 'System',
                performedByEmail: 'system@auto',
                performedAt: now,
              });

              logger.info(`Auto-updated shutterExpiry status for camera ${camera.camera}: ON (shutter count: ${shutterCount}, memory: ${memory ? 'found' : 'not found'})`);
            }
          } else {
            // Clearing shutter expiry - only log removal if it was previously marked
            if (currentlyShutterExpiry) {
              // Log the status change in history
              cameraStatusHistoryController.recordStatusChange({
                cameraId: camera._id,
                cameraName: camera.camera,
                developerId: camera.developer,
                projectId: camera.project,
                statusType: 'shutterExpiry',
                action: 'off',
                performedBy: 'System',
                performedByEmail: 'system@auto',
                performedAt: now,
              });

              logger.info(`Auto-updated shutterExpiry status for camera ${camera.camera}: OFF (shutter count: ${shutterCount}, memory: ${memory ? 'found' : 'not found'})`);
            }
          }
        }

        // Automatically update deviceExpiry status based on assigned inventory items
        // Extract actual developer and project IDs from camera object (not tags from route params)
        const actualDeveloperId = typeof camera.developer === 'object' 
          ? camera.developer._id 
          : camera.developer;
        const actualProjectId = typeof camera.project === 'object' 
          ? camera.project._id 
          : camera.project;
        
        const inventoryItems = getInventoryItemsByCamera(
          camera._id, 
          camera.camera, 
          actualDeveloperId, 
          actualProjectId
        );
        const deviceTypes = deviceTypeData.getAllItems();

        let hasDeviceExpired = false;
        let expiredItemDetails = null;
        
        if (inventoryItems.length > 0) {
          logger.info(`Checking device expiry for camera ${camera.camera} (ID: ${camera._id}): ${inventoryItems.length} assigned inventory items`);
          
          // Check if any assigned device has validityLeft <= 0
          for (const item of inventoryItems) {
            const validityLeft = calculateValidityLeft(item, deviceTypes);
            
            // Log details for debugging
            const deviceName = item.device?.deviceName || item.device?.model || 'Unknown device';
            const serialNumber = item.device?.serialNumber || item._id;
            const deviceType = item.device?.type || 'Unknown type';
            
            // Log item details for debugging
            logger.info(`Camera ${camera.camera}, checking item ${serialNumber} (${deviceName}, type: ${deviceType}): validityLeft=${validityLeft}, status=${item.status}, hasCurrentAssignment=${!!item.currentAssignment}`);
            
            if (validityLeft === null) {
              logger.warn(`Cannot calculate validity for camera ${camera.camera}, item ${serialNumber} (${deviceName}): missing validity data. Device type: ${deviceType}, item validityDays: ${item.validityDays}, estimatedAge: ${item.estimatedAge}`);
              continue;
            }
            
            logger.debug(`Camera ${camera.camera}, item ${serialNumber} (${deviceName}): validityLeft=${validityLeft}`);
            
            if (validityLeft <= 0) {
              hasDeviceExpired = true;
              expiredItemDetails = {
                itemId: item._id,
                deviceName,
                serialNumber,
                validityLeft,
              };
              logger.info(`Device expiry detected for camera ${camera.camera}: item ${serialNumber} (${deviceName}) has validityLeft=${validityLeft}`);
              break;
            }
          }
        } else {
          logger.warn(`No assigned inventory items found for camera ${camera.camera} (ID: ${camera._id}, Developer ID: ${actualDeveloperId}, Project ID: ${actualProjectId}). Checking all inventory items for debugging...`);
          
          // Debug: Log all inventory items to see why none match
          const allItems = inventoryData.getAllItems();
          const assignedItems = allItems.filter(item => item.status === 'assigned');
          logger.info(`Total inventory items: ${allItems.length}, Items with status 'assigned': ${assignedItems.length}`);
          
          // Log a few assigned items for debugging
          for (let i = 0; i < Math.min(5, assignedItems.length); i++) {
            const item = assignedItems[i];
            const assignment = item.currentAssignment;
            logger.info(`Sample assigned item ${i + 1}: ID=${item._id}, status=${item.status}, hasCurrentAssignment=${!!assignment}, assignment.developer=${assignment?.developer}, assignment.project=${assignment?.project}, assignment.camera=${assignment?.camera}`);
          }
        }

        const currentlyDeviceExpiry = currentStatusFromHistory.deviceExpiry;

        if (hasDeviceExpired !== currentlyDeviceExpiry) {
          const now = new Date().toISOString();
          
          if (hasDeviceExpired) {
            // Marking as device expiry - only log if not already marked
            if (!currentlyDeviceExpiry) {
              // Log the status change in history
              cameraStatusHistoryController.recordStatusChange({
                cameraId: camera._id,
                cameraName: camera.camera,
                developerId: camera.developer,
                projectId: camera.project,
                statusType: 'deviceExpiry',
                action: 'on',
                performedBy: 'System',
                performedByEmail: 'system@auto',
                performedAt: now,
              });

              logger.info(`Auto-updated deviceExpiry status for camera ${camera.camera}: ON (inventory items checked: ${inventoryItems.length}${expiredItemDetails ? `, expired item: ${expiredItemDetails.serialNumber} (${expiredItemDetails.deviceName}), validityLeft=${expiredItemDetails.validityLeft}` : ''})`);
            }
          } else {
            // Clearing device expiry - only log removal if it was previously marked
            if (currentlyDeviceExpiry) {
              // Log the status change in history
              cameraStatusHistoryController.recordStatusChange({
                cameraId: camera._id,
                cameraName: camera.camera,
                developerId: camera.developer,
                projectId: camera.project,
                statusType: 'deviceExpiry',
                action: 'off',
                performedBy: 'System',
                performedByEmail: 'system@auto',
                performedAt: now,
              });

              logger.info(`Auto-updated deviceExpiry status for camera ${camera.camera}: OFF (inventory items checked: ${inventoryItems.length}, all items have validityLeft > 0)`);
            }
          }
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

