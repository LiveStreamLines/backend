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

module.exports = {
  getCameraPictures
}