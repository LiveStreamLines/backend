const fs = require('fs');
const path = require('path');
const logger = require('../logger');

// Define the root directory for camera pictures
const mediaRoot = process.env.MEDIA_PATH + '/upload';

function getImagesByDateRange(req, res) {
  const { projectId, cameraId } = req.params;
  const { day1, time1, day2, time2 } = req.body;
  const developerId = 'seeb'; // Static developer ID

  // Validate required parameters (day1 and time1 are always required)
  if (!day1 || !time1) {
    return res.status(400).json({ 
      error: 'Missing required parameters: day1, time1' 
    });
  }

  // Validate date format (YYYYMMDD) for day1
  const dateRegex = /^\d{8}$/;
  if (!dateRegex.test(day1)) {
    return res.status(400).json({ 
      error: 'Invalid date format. Use YYYYMMDD format for day1' 
    });
  }

  // Validate time format (HHMMSS) for time1
  const timeRegex = /^\d{6}$/;
  if (!timeRegex.test(time1)) {
    return res.status(400).json({ 
      error: 'Invalid time format. Use HHMMSS format for time1' 
    });
  }

  // If day2 and time2 are not provided, calculate 1 hour later from day1 and time1
  let finalDay2, finalTime2;
  
  if (!day2 || !time2) {
    // Parse the start date and time
    const year = parseInt(day1.slice(0, 4));
    const month = parseInt(day1.slice(4, 6)) - 1; // Month is 0-based in Date constructor
    const day = parseInt(day1.slice(6, 8));
    const hour = parseInt(time1.slice(0, 2));
    const minute = parseInt(time1.slice(2, 4));
    const second = parseInt(time1.slice(4, 6));

    // Create a Date object and add 1 hour
    const startDate = new Date(year, month, day, hour, minute, second);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour (60 minutes * 60 seconds * 1000 milliseconds)

    // Format the end date and time
    finalDay2 = endDate.getFullYear().toString() + 
                String(endDate.getMonth() + 1).padStart(2, '0') + 
                String(endDate.getDate()).padStart(2, '0');
    finalTime2 = String(endDate.getHours()).padStart(2, '0') + 
                 String(endDate.getMinutes()).padStart(2, '0') + 
                 String(endDate.getSeconds()).padStart(2, '0');
  } else {
    // Validate day2 and time2 if provided
    if (!dateRegex.test(day2)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYYMMDD format for day2' 
      });
    }
    if (!timeRegex.test(time2)) {
      return res.status(400).json({ 
        error: 'Invalid time format. Use HHMMSS format for time2' 
      });
    }
    finalDay2 = day2;
    finalTime2 = time2;
  }

  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');

  // Check if the camera directory exists
  if (!fs.existsSync(cameraPath)) {
    return res.status(404).json({ error: 'Camera directory not found' });
  }

  // Read all image files in the camera directory
  const files = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));

  if (files.length === 0) {
    return res.status(404).json({ error: 'No pictures found in camera directory' });
  }

  // Create start and end timestamps for comparison
  const startTimestamp = day1 + time1; // YYYYMMDDHHMMSS
  const endTimestamp = finalDay2 + finalTime2;   // YYYYMMDDHHMMSS

  // Filter files based on the date and time range
  const filteredFiles = files.filter(file => {
    // Extract timestamp from filename (YYYYMMDDHHMMSS)
    const fileTimestamp = file.replace('.jpg', '');
    
    // Check if file timestamp is within the specified range
    return fileTimestamp >= startTimestamp && fileTimestamp <= endTimestamp;
  });

  // Sort files by timestamp (ascending order)
  filteredFiles.sort();

  // Return the filtered images with metadata
  res.json({
    images: filteredFiles.map(file => file.replace('.jpg', '')), // Remove .jpg extension
    count: filteredFiles.length,
    dateRange: {
      start: `${day1} ${time1.slice(0,2)}:${time1.slice(2,4)}:${time1.slice(4,6)}`,
      end: `${finalDay2} ${finalTime2.slice(0,2)}:${finalTime2.slice(2,4)}:${finalTime2.slice(4,6)}`
    },
    path: `${req.protocol}://${req.get('host')}/backend/media/upload/${developerId}/${projectId}/${cameraId}/large`,
    autoCalculated: !day2 || !time2 // Indicate if the end time was auto-calculated
  });
}

module.exports = {
  getImagesByDateRange
};
