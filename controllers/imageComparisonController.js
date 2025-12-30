const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const logger = require('../logger');

// Path to the Python script
const pythonScriptPath = path.join(__dirname, '../utils/imageComparison.py');
const mediaRoot = process.env.MEDIA_PATH + '/upload';

/**
 * Find the first image matching a date and time prefix
 * @param {string} cameraPath - Path to camera directory
 * @param {string} date - Date in YYYYMMDD format
 * @param {string} timePrefix - Time prefix (e.g., "12", "1200", "120000")
 * @returns {string|null} - Filename of first matching image or null
 */
function findFirstMatchingImage(cameraPath, date, timePrefix) {
  if (!fs.existsSync(cameraPath)) {
    return null;
  }

  // Read all JPG files
  const files = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));
  
  // Create prefix to search for (date + time prefix)
  const searchPrefix = date + timePrefix;
  
  // Find files that start with the prefix and sort them
  const matchingFiles = files
    .filter(file => file.startsWith(searchPrefix))
    .sort();
  
  // Return the first matching file (earliest time)
  return matchingFiles.length > 0 ? matchingFiles[0] : null;
}

/**
 * Normalize time input to handle partial times
 * Accepts: "12", "1200", "120000", or full "120000"
 * Returns the time as a prefix for searching (no padding)
 * @param {string} time - Time input (can be partial)
 * @returns {string} - Time prefix for searching
 */
function normalizeTime(time) {
  if (!time) {
    return '120000'; // Default to 12:00:00 (exact match)
  }
  
  // Convert to string and trim
  const timeStr = String(time).trim();
  
  // Validate it's numeric
  if (!/^\d+$/.test(timeStr)) {
    throw new Error(`Invalid time format: ${timeStr}. Time must be numeric (e.g., "12", "1200", "120000")`);
  }
  
  // For 1-digit hour, pad to 2 digits (e.g., "9" -> "09")
  if (timeStr.length === 1) {
    return '0' + timeStr;
  }
  
  // Return as-is for prefix matching
  // "12" will match any time starting with 12 (12:00:00, 12:05:30, etc.)
  // "1200" will match any time starting with 1200 (12:00:00, 12:00:15, etc.)
  // "120000" will match exactly 12:00:00
  return timeStr;
}

/**
 * Compare two images from the same project and camera at different dates
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * 
 * Expected request body:
 * {
 *   developerId: string,
 *   projectId: string,
 *   cameraId: string,
 *   date1: string (YYYYMMDD format),
 *   date2: string (YYYYMMDD format),
 *   time1: string (HH, HHMM, or HHMMSS format, optional - defaults to 120000),
 *   time2: string (HH, HHMM, or HHMMSS format, optional - defaults to 120000),
 *   align: boolean (optional - defaults to true)
 * }
 */
function compareImages(req, res) {
  const { developerId, projectId, cameraId, date1, date2, time1, time2, align } = req.body;

  // Validate required parameters
  if (!developerId || !projectId || !cameraId || !date1 || !date2) {
    return res.status(400).json({
      error: 'Missing required parameters: developerId, projectId, cameraId, date1, date2'
    });
  }

  // Validate date format (YYYYMMDD)
  const dateRegex = /^\d{8}$/;
  if (!dateRegex.test(date1) || !dateRegex.test(date2)) {
    return res.status(400).json({
      error: 'Invalid date format. Use YYYYMMDD format for dates'
    });
  }

  // Construct image paths
  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');
  
  // Normalize times and find matching images
  let time1Prefix, time2Prefix;
  try {
    time1Prefix = normalizeTime(time1);
    time2Prefix = normalizeTime(time2);
  } catch (error) {
    return res.status(400).json({
      error: error.message
    });
  }
  
  // Find first matching images
  const image1Filename = findFirstMatchingImage(cameraPath, date1, time1Prefix);
  const image2Filename = findFirstMatchingImage(cameraPath, date2, time2Prefix);
  
  if (!image1Filename) {
    return res.status(404).json({
      error: `No image found for date1: ${date1} with time prefix: ${time1Prefix}`,
      path: cameraPath
    });
  }
  
  if (!image2Filename) {
    return res.status(404).json({
      error: `No image found for date2: ${date2} with time prefix: ${time2Prefix}`,
      path: cameraPath
    });
  }

  const image1Path = path.join(cameraPath, image1Filename);
  const image2Path = path.join(cameraPath, image2Filename);

  // Verify images exist (should already be found, but double-check)
  if (!fs.existsSync(image1Path)) {
    return res.status(404).json({
      error: `Image 1 not found: ${image1Filename}`,
      path: image1Path
    });
  }

  if (!fs.existsSync(image2Path)) {
    return res.status(404).json({
      error: `Image 2 not found: ${image2Filename}`,
      path: image2Path
    });
  }

  // Create output directory for highlighted images if it doesn't exist
  const outputDir = path.join(cameraPath, 'comparisons');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate output filename
  const outputFilename = `comparison_${date1}_${date2}_${Date.now()}.jpg`;
  const outputPath = path.join(outputDir, outputFilename);

  // Determine if alignment should be used
  const shouldAlign = align !== false; // Default to true unless explicitly set to false

  // Build Python command (try python3 first, fallback to python)
  const alignFlag = shouldAlign ? '' : '--no-align';
  // Use python3 on Unix systems, python on Windows
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pythonCommand = `${pythonCmd} "${pythonScriptPath}" "${image1Path}" "${image2Path}" "${outputPath}" ${alignFlag}`.trim();

  logger.info(`Comparing images: ${image1Filename} vs ${image2Filename}`);
  logger.info(`Python command: ${pythonCommand}`);

  // Execute Python script
  exec(pythonCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      logger.error('Error executing Python script:', error);
      logger.error('stderr:', stderr);
      return res.status(500).json({
        error: 'Failed to compare images',
        details: error.message,
        stderr: stderr
      });
    }

    try {
      // Parse JSON output from Python script
      const result = JSON.parse(stdout);

      if (result.error) {
        logger.error('Python script error:', result.error);
        return res.status(500).json(result);
      }

      // Convert output path to URL if image was saved
      if (result.highlighted_image_path && fs.existsSync(result.highlighted_image_path)) {
        const relativePath = path.relative(mediaRoot, result.highlighted_image_path).replace(/\\/g, '/');
        result.highlighted_image_url = `${req.protocol}://${req.get('host')}/media/upload/${relativePath}`;
      }

      // Add image URLs and metadata
      result.image1_url = `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/large/${image1Filename}`;
      result.image2_url = `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/large/${image2Filename}`;
      result.image1_filename = image1Filename;
      result.image2_filename = image2Filename;
      result.time1_used = image1Filename.substring(8, 14); // Extract time from filename
      result.time2_used = image2Filename.substring(8, 14); // Extract time from filename

      logger.info(`Image comparison completed: ${result.difference_percentage}% difference, Activity: ${result.activity}`);

      res.json(result);
    } catch (parseError) {
      logger.error('Error parsing Python script output:', parseError);
      logger.error('stdout:', stdout);
      logger.error('stderr:', stderr);
      return res.status(500).json({
        error: 'Failed to parse comparison results',
        details: parseError.message,
        stdout: stdout,
        stderr: stderr
      });
    }
  });
}

/**
 * Compare images by providing direct image paths (alternative endpoint)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * 
 * Expected request body:
 * {
 *   image1Path: string (full path to first image),
 *   image2Path: string (full path to second image),
 *   align: boolean (optional)
 * }
 */
function compareImagesByPath(req, res) {
  const { image1Path, image2Path, align } = req.body;

  if (!image1Path || !image2Path) {
    return res.status(400).json({
      error: 'Missing required parameters: image1Path, image2Path'
    });
  }

  // Check if images exist
  if (!fs.existsSync(image1Path)) {
    return res.status(404).json({
      error: `Image 1 not found: ${image1Path}`
    });
  }

  if (!fs.existsSync(image2Path)) {
    return res.status(404).json({
      error: `Image 2 not found: ${image2Path}`
    });
  }

  // Create output directory
  const outputDir = path.join(path.dirname(image1Path), 'comparisons');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Generate output filename
  const outputFilename = `comparison_${Date.now()}.jpg`;
  const outputPath = path.join(outputDir, outputFilename);

  // Build Python command
  const shouldAlign = align !== false;
  const alignFlag = shouldAlign ? '' : '--no-align';
  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
  const pythonCommand = `${pythonCmd} "${pythonScriptPath}" "${image1Path}" "${image2Path}" "${outputPath}" ${alignFlag}`.trim();

  logger.info(`Comparing images by path: ${image1Path} vs ${image2Path}`);

  // Execute Python script
  exec(pythonCommand, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) {
      logger.error('Error executing Python script:', error);
      return res.status(500).json({
        error: 'Failed to compare images',
        details: error.message
      });
    }

    try {
      const result = JSON.parse(stdout);

      if (result.error) {
        return res.status(500).json(result);
      }

      if (result.highlighted_image_path && fs.existsSync(result.highlighted_image_path)) {
        result.highlighted_image_path = result.highlighted_image_path;
      }

      res.json(result);
    } catch (parseError) {
      logger.error('Error parsing Python script output:', parseError);
      return res.status(500).json({
        error: 'Failed to parse comparison results',
        details: parseError.message
      });
    }
  });
}

module.exports = {
  compareImages,
  compareImagesByPath
};

