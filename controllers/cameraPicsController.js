const fs = require('fs');
const path = require('path');

// Define the root directory for camera pictures
const mediaRoot = process.env.MEDIA_PATH + '/upload';

// Controller function to get camera pictures
function getCameraPictures (req, res) {
  
  const { developerId, projectId, cameraId } = req.params;
  const { date1, date2 } = req.body; // Optional date filters in the format YYYYMMDD

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

  // Sort files by name to get the first and last pictures
  const sortedFiles = files.sort();
  const firstPic = sortedFiles[0];
  const lastPic = sortedFiles[sortedFiles.length - 1];

  // Extract dates from firstPic and lastPic if date1 or date2 are not provided
  const defaultDate1 = firstPic.slice(0, 8); // YYYYMMDD format
  const defaultDate2 = lastPic.slice(0, 8); // YYYYMMDD format
  const dateFilter1 = date1 || defaultDate1;
  const dateFilter2 = date2 || defaultDate2;

  // Filter files based on date1 and date2 prefixes
  const date1Files = sortedFiles.filter(file => file.startsWith(dateFilter1));
  const date2Files = sortedFiles.filter(file => file.startsWith(dateFilter2));

  // Respond with the first, last, date1, and date2 pictures
  res.json({
    firstPhoto: firstPic.replace('.jpg', ''), // Filename without extension
    lastPhoto: lastPic.replace('.jpg', ''), // Filename without extension
    date1Photos: date1Files.map(file => file.replace('.jpg', '')),
    date2Photos: date2Files.map(file => file.replace('.jpg', '')),
    path: `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/`
  });
}

function getCameraPreview(req, res) {
  const { developerId, projectId, cameraId } = req.params;
  
  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');
  
  if (!fs.existsSync(cameraPath)) {
    return res.status(404).json({ error: 'Camera directory not found' });
  }

  const files = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));
  
  if (files.length === 0) {
    return res.status(404).json({ error: 'No pictures found in camera directory' });
  }
  
  // Sort files by name to ensure the oldest picture is first
  const sortedFiles = files.sort();
  const startDate = sortedFiles[0].slice(0, 8); // Extract date from the first file
  const startDateObj = new Date(
    startDate.slice(0, 4), // Year
    startDate.slice(4, 6) - 1, // Month (zero-based)
    startDate.slice(6, 8) // Day
  );
  
  const currentDate = new Date();
  
  // Collect one image per week starting from the start date up to today
  const weeklyImages = [];
  let currentWeekStart = startDateObj;
  
  while (currentWeekStart <= currentDate) {
    const weekStartDate = currentWeekStart.toISOString().slice(0, 10).replace(/-/g, ''); // Get YYYYMMDD for the week
    const weeklyFiles = sortedFiles.filter(file => {
      const fileDateStr = file.slice(0, 8); // Extract date (YYYYMMDD)
      const fileTimeStr = file.slice(8, 12); // Extract time (HHMM)
      return file.startsWith(weekStartDate) && fileTimeStr.startsWith('12'); // Match any time between 12:00 and 12:59
    });
    
    if (weeklyFiles.length > 0) {
      // Pick the first image for that week
      weeklyImages.push(weeklyFiles[0].replace('.jpg', '')); // Add only the image name without extension
    }
    
    // Move to the next week
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  if (weeklyImages.length === 0) {
    return res.status(404).json({ error: 'No weekly images found' });
  }

  res.json({
    weeklyImages,
    path: `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/`
  });
}

module.exports = {
  getCameraPreview,
  getCameraPictures
}