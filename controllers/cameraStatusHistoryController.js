const cameraStatusHistoryData = require('../models/cameraStatusHistoryData');
const logger = require('../logger');

/**
 * Records a status change event (photo dirty / better view toggles).
 * This helper can be reused from other controllers (e.g. cameraController).
 */
function recordStatusChange({
  cameraId,
  cameraName,
  developerId,
  projectId,
  statusType,
  action,
  performedBy,
  performedByEmail = null,
  performedAt = new Date().toISOString(),
}) {
  try {
    if (!cameraId || !statusType || !action) {
      throw new Error('cameraId, statusType, and action are required to record status history.');
    }

    const isActive = action === 'on';

    return cameraStatusHistoryData.addItem({
      cameraId,
      cameraName,
      developerId,
      projectId,
      statusType,
      action,
      isActive,
      performedBy: performedBy || 'Unknown',
      performedByEmail,
      performedAt,
    });
  } catch (error) {
    logger.error('Failed to record camera status history:', error);
    return null;
  }
}

function getAllHistory(req, res) {
  try {
    const entries = cameraStatusHistoryData.getAllItems();
    res.json(entries);
  } catch (error) {
    logger.error('Failed to fetch camera status history:', error);
    res.status(500).json({ message: 'Unable to fetch history' });
  }
}

function getHistoryByCamera(req, res) {
  try {
    const { cameraId } = req.params;
    if (!cameraId) {
      return res.status(400).json({ message: 'cameraId is required' });
    }
    const entries = cameraStatusHistoryData.getByCameraId(cameraId);
    res.json(entries);
  } catch (error) {
    logger.error('Failed to fetch camera status history by camera:', error);
    res.status(500).json({ message: 'Unable to fetch history' });
  }
}

function getCurrentStatus(req, res) {
  try {
    const { cameraId } = req.params;
    if (!cameraId) {
      return res.status(400).json({ message: 'cameraId is required' });
    }
    
    const currentStatus = getCurrentStatusFromHistory(cameraId);
    const statusMetadata = {
      photoDirty: getStatusMetadataFromHistory(cameraId, 'photoDirty'),
      betterView: getStatusMetadataFromHistory(cameraId, 'betterView'),
      lowImages: getStatusMetadataFromHistory(cameraId, 'lowImages'),
      wrongTime: getStatusMetadataFromHistory(cameraId, 'wrongTime'),
      shutterExpiry: getStatusMetadataFromHistory(cameraId, 'shutterExpiry'),
      deviceExpiry: getStatusMetadataFromHistory(cameraId, 'deviceExpiry'),
    };
    
    res.json({
      currentStatus,
      statusMetadata,
    });
  } catch (error) {
    logger.error('Failed to get current status from history:', error);
    res.status(500).json({ message: 'Unable to fetch current status' });
  }
}

/**
 * Gets the current status for a camera based on the most recent history entry for each status type.
 * Returns an object with status types as keys and boolean values indicating if they're currently active.
 */
function getCurrentStatusFromHistory(cameraId) {
  try {
    const entries = cameraStatusHistoryData.getByCameraId(cameraId);
    if (!entries || entries.length === 0) {
      return {
        photoDirty: false,
        betterView: false,
        lowImages: false,
        wrongTime: false,
        shutterExpiry: false,
        deviceExpiry: false,
      };
    }

    // Sort by performedAt descending (most recent first)
    const sorted = [...entries].sort((a, b) => 
      new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime()
    );

    // Get the most recent action for each status type
    const statusMap = {};
    for (const entry of sorted) {
      if (!statusMap.hasOwnProperty(entry.statusType)) {
        statusMap[entry.statusType] = entry.action === 'on';
      }
    }

    return {
      photoDirty: statusMap.photoDirty || false,
      betterView: statusMap.betterView || false,
      lowImages: statusMap.lowImages || false,
      wrongTime: statusMap.wrongTime || false,
      shutterExpiry: statusMap.shutterExpiry || false,
      deviceExpiry: statusMap.deviceExpiry || false,
    };
  } catch (error) {
    logger.error('Failed to get current status from history:', error);
    return {
      photoDirty: false,
      betterView: false,
      lowImages: false,
      wrongTime: false,
      shutterExpiry: false,
      deviceExpiry: false,
    };
  }
}

/**
 * Gets the most recent history entry for a specific status type, including who marked/removed it and when.
 */
function getStatusMetadataFromHistory(cameraId, statusType) {
  try {
    const entries = cameraStatusHistoryData.getByCameraId(cameraId);
    if (!entries || entries.length === 0) {
      return null;
    }

    // Filter by status type and sort by performedAt descending
    const filtered = entries
      .filter(e => e.statusType === statusType)
      .sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());

    if (filtered.length === 0) {
      return null;
    }

    const mostRecent = filtered[0];
    const isActive = mostRecent.action === 'on';

    // Find the most recent "on" action for marking info
    const markedEntry = filtered.find(e => e.action === 'on');
    // Find the most recent "off" action for removal info
    const removedEntry = filtered.find(e => e.action === 'off');

    return {
      isActive,
      markedBy: markedEntry?.performedBy || null,
      markedAt: markedEntry?.performedAt || null,
      markedByEmail: markedEntry?.performedByEmail || null,
      removedBy: removedEntry?.performedBy || null,
      removedAt: removedEntry?.performedAt || null,
      removedByEmail: removedEntry?.performedByEmail || null,
    };
  } catch (error) {
    logger.error('Failed to get status metadata from history:', error);
    return null;
  }
}

module.exports = {
  getAllHistory,
  getHistoryByCamera,
  getCurrentStatus,
  recordStatusChange,
  getCurrentStatusFromHistory,
  getStatusMetadataFromHistory,
};

