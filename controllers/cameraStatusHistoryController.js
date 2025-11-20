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

module.exports = {
  getAllHistory,
  getHistoryByCamera,
  recordStatusChange,
};

