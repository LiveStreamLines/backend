// controllers/syncController.js
const { exec } = require('child_process');
const logger = require('../logger');

/**
 * Execute the tempsync.sh script
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function triggerSync(req, res) {
  try {
    const scriptPath = '/home/lslcloud/tempsync.sh';
    
    logger.info(`Triggering sync script: ${scriptPath}`);
    
    // Execute the shell script
    exec(`bash ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Error executing sync script: ${error.message}`);
        return res.status(500).json({
          success: false,
          error: 'Failed to execute sync script',
          message: error.message,
          stderr: stderr
        });
      }
      
      logger.info(`Sync script executed successfully. Output: ${stdout}`);
      
      res.status(200).json({
        success: true,
        message: 'Sync script executed successfully',
        output: stdout,
        timestamp: new Date().toISOString()
      });
    });
  } catch (error) {
    logger.error('Error in triggerSync:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

module.exports = {
  triggerSync
};

