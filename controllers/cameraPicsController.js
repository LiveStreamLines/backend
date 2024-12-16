const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');


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

// Helper function to get weekly images
function getWeeklyImages(cameraPath) {
  if (!fs.existsSync(cameraPath)) {
    throw new Error('Camera directory not found');
  }

  const files = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));

  if (files.length === 0) {
    throw new Error('No pictures found in camera directory');
  }

  // Sort files and collect weekly images
  const sortedFiles = files.sort();
  const startDate = sortedFiles[0].slice(0, 8); // Extract date from the first file
  const startDateObj = new Date(
    startDate.slice(0, 4),
    startDate.slice(4, 6) - 1,
    startDate.slice(6, 8)
  );

  const currentDate = new Date();
  const weeklyImages = [];
  let currentWeekStart = startDateObj;

  while (currentWeekStart <= currentDate) {
    const weekStartDate = currentWeekStart.toISOString().slice(0, 10).replace(/-/g, '');
    const weeklyFiles = sortedFiles.filter(file => {
      const fileDateStr = file.slice(0, 8);
      const fileTimeStr = file.slice(8, 12);
      return file.startsWith(weekStartDate) && fileTimeStr.startsWith('12');
    });

    if (weeklyFiles.length > 0) {
      weeklyImages.push(path.join(cameraPath, weeklyFiles[0])); // Add the full path of the image
    }

    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }

  if (weeklyImages.length === 0) {
    throw new Error('No weekly images found');
  }

  return weeklyImages;
}


function getCameraPreview(req, res) {
  const { developerId, projectId, cameraId } = req.params;  
  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');
  
  try {
    const weeklyImages = getWeeklyImages(cameraPath);

    // Extract image filenames (without extensions)
    const weeklyImageNames = weeklyImages.map(imagePath => {
      return path.basename(imagePath, '.jpg');
    });

    res.json({
      weeklyImages: weeklyImageNames,
      path: `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/`
    });

  } catch (error) {
    res.status(404).json({ error: error.message });
  }
  
}

function generateWeeklyVideo(req, res) {
  const { developerId, projectId, cameraId } = req.params;
  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');
  const outputPath = path.join(mediaRoot, developerId, projectId, cameraId, 'weekly_video.mp4');

  try {
    const weeklyImages = getWeeklyImages(cameraPath);

    if (weeklyImages.length < 2) {
      return res.status(400).json({ error: 'Not enough images to generate a video.' });
    }

    // Ensure the images are numbered sequentially for FFmpeg
    const tempDir = path.join(cameraPath, 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir);
    }

    // Copy images to a temporary directory with sequential names (e.g., 001.jpg, 002.jpg)
    weeklyImages.forEach((imagePath, index) => {
      const sequentialName = path.join(tempDir, `${String(index + 1).padStart(3, '0')}.jpg`);
      fs.copyFileSync(imagePath, sequentialName);
    });

    const tempInputPattern = path.join(tempDir, '%03d.jpg'); // Sequential input pattern for FFmpeg

    ffmpeg()
      .input(tempInputPattern)
      .inputOptions(['-framerate 1']) // Set frame rate (1 frame per second)
      .outputOptions(['-pix_fmt yuv420p']) // Ensure compatibility with most players
      .on('end', () => {
        // Clean up the temporary directory
        fs.rmSync(tempDir, { recursive: true, force: true });

        res.json({
          message: 'Video generated successfully',
          videoPath: `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/weekly_video.mp4`
        });
      })
      .on('error', err => {
        console.error('Error generating video:', err);

        // Clean up the temporary directory on error
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }

        res.status(500).json({ error: 'Failed to generate video' });
      })
      .save(outputPath);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
}



module.exports = {
  getCameraPreview,
  generateWeeklyVideo,  
  getCameraPictures
}