const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const { log } = require('console');

const mediaRoot = process.env.MEDIA_PATH + '/upload';

function generateVideo(req, res) {
  const { developerId, projectId, cameraId, date1, date2, hour1, hour2, frameRate, duration } = req.body;

  // Define the camera folder path
  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');

  // Check if the camera directory exists
  if (!fs.existsSync(cameraPath)) {
    return res.status(404).json({ error: 'Camera directory not found' });
  }

  // Read all image files in the camera directory
  const allFiles = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));

  // Filter files based on date and hour range
  const filteredFiles = allFiles.filter(file => {
    const fileDate = file.substring(0, 8); // Extract YYYYMMDD from filename
    const fileHour = file.substring(8, 10); // Extract HH from filename
    return fileDate >= date1 && fileDate <= date2 && fileHour >= hour1 && fileHour <= hour2;
  });

  const numFilteredPics = filteredFiles.length;

  if (numFilteredPics === 0) {
    return res.status(404).json({ error: 'No pictures found for the specified date and hour range' });
  }

  // Create a text file with paths to the filtered images
  const listFilePath = path.join(os.tmpdir(), 'image_list.txt');
  const fileListContent = filteredFiles.map(file => `file '${path.join(cameraPath, file)}'`).join('\n');
  fs.writeFileSync(listFilePath, fileListContent);

  // Define the output video path
  const outputVideoPath = path.join(cameraPath, 'output_video.mp4');

  // Determine frame rate or calculate based on duration
  let finalFrameRate = frameRate || 25; // Default to 25 fps if frameRate is not provided

  // Adjust frame rate if duration is specified
  if (duration && !frameRate) {
    finalFrameRate = Math.ceil(numFilteredPics / duration);
  }

  const startTime = Date.now(); // Track the start time for measuring duration

  // Use FFmpeg to generate the video using the text file as input
  ffmpeg()
    .input(listFilePath)
    .inputOptions(['-f concat', '-safe 0', '-r ' + finalFrameRate])
    .outputOptions([
      '-r ' + finalFrameRate, // Set the frame rate
      '-c:v libx264', // Use H.264 codec
      '-preset slow', // Use a slower preset for better quality
      '-crf 18', // Constant Rate Factor for high quality (lower value = better quality)
      '-pix_fmt yuv420p' // Pixel format for compatibility
    ])
    .output(outputVideoPath)
    .on('end', () => {
      const endTime = Date.now();
      const timeTaken = (endTime - startTime) / 1000; // Time taken in seconds
      const videoLength = numFilteredPics / finalFrameRate; // Length of the video in seconds

      // Get the size of the output video file
      const fileSize = fs.statSync(outputVideoPath).size / (1024 * 1024); // Size in MB

      // Delete the list file after the video is generated
      fs.unlinkSync(listFilePath);

      // Send the response with additional information
      res.json({
        message: 'Video generated successfully',
        videoPath: outputVideoPath,
        filteredImageCount: numFilteredPics,
        videoLength: videoLength.toFixed(2) + ' seconds',
        fileSize: fileSize.toFixed(2) + ' MB',
        timeTaken: timeTaken.toFixed(2) + ' seconds'
      });
    })
    .on('error', err => {
      console.error(err);
      fs.unlinkSync(listFilePath); // Clean up on error
      res.status(500).json({ error: 'Failed to generate video' });
    })
    .run();
}

function generateCustomId() {
  return Array.from(Array(24), () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function filterPics(req, res) {
  const { developerId, projectId, cameraId, date1, date2, hour1, hour2 } = req.body;

  // Define the camera folder path
  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');
  const videoFolderPath = path.join(mediaRoot, developerId, projectId, cameraId, 'videos');

  // Check if the camera directory exists
  if (!fs.existsSync(cameraPath)) {
    return res.status(404).json({ error: 'Camera directory not found' });
  }

  // Read all image files in the camera directory
  const allFiles = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));

  // Filter files based on date and hour range
  const filteredFiles = allFiles.filter(file => {
    const fileDate = file.substring(0, 8); // Extract YYYYMMDD from filename
    const fileHour = file.substring(8, 10); // Extract HH from filename
    return fileDate >= date1 && fileDate <= date2 && fileHour >= hour1 && fileHour <= hour2;
  });

  const numFilteredPics = filteredFiles.length;

  if (numFilteredPics === 0) {
    return res.status(404).json({ error: 'No pictures found for the specified date and hour range' });
  }

  // Create a text file with paths to the filtered images
  const uniqueId = generateCustomId();
  const listFileName = `image_list_${uniqueId}.txt`;
  const listFilePath = path.join(videoFolderPath, listFileName);
  const fileListContent = filteredFiles.map(file => `file '${path.join(cameraPath, file)}'`).join('\n');
  fs.writeFileSync(listFilePath, fileListContent);

  // Log the request
  const logEntry = {
    "developer": developerId,
    "project": projectId,
    "camera": cameraId,
    "RequestTime": new Date().toISOString(),
    "filteredImageCount": numFilteredPics,
    "id": uniqueId,
    "listFile" : listFileName
  };
  const newRequest = logEntry;
  const addedCamera = cameraData.addItem(newCamera);

  // Respond with filtered image count and the list file path
  res.json({
    message: 'Pictures filtered successfully',
    listFilePath,
    filteredImageCount: numFilteredPics
  });
}

function generateVideoFromList(req, res) {
  const { developerId, projectId, cameraId, listFilePath, frameRate, duration } = req.body;

  // Ensure the list file exists
  if (!fs.existsSync(listFilePath)) {
    return res.status(404).json({ error: 'List file not found' });
  }

  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');
  const filteredFiles = fs.readFileSync(listFilePath, 'utf8').split('\n').length;

  const uniqueVideoName = `video_${uuidv4()}.mp4`;
  const outputVideoPath = path.join(cameraPath, uniqueVideoName);

  let finalFrameRate = frameRate || 25;
  if (duration && !frameRate) {
    finalFrameRate = Math.ceil(filteredFiles / duration);
  }

  const startTime = Date.now();

  ffmpeg()
    .input(listFilePath)
    .inputOptions(['-f concat', '-safe 0', '-r ' + finalFrameRate])
    .outputOptions([
      '-r ' + finalFrameRate,
      '-c:v libx264',
      '-preset slow',
      '-crf 18',
      '-pix_fmt yuv420p'
    ])
    .output(outputVideoPath)
    .on('end', () => {
      const endTime = Date.now();
      const timeTaken = (endTime - startTime) / 1000;
      const videoLength = filteredFiles / finalFrameRate;
      const fileSize = fs.statSync(outputVideoPath).size / (1024 * 1024);

      // Log the request
      const logEntry = {
        developerId,
        projectId,
        cameraId,
        timeOfRequest: new Date().toISOString(),
        filteredImageCount: filteredFiles,
        videoName: uniqueVideoName
      };
      logRequest(logFilePath, logEntry);

      // Respond with video generation details
      res.json({
        message: 'Video generated successfully',
        videoPath: outputVideoPath,
        filteredImageCount: filteredFiles,
        videoLength: videoLength.toFixed(2) + ' seconds',
        fileSize: fileSize.toFixed(2) + ' MB',
        timeTaken: timeTaken.toFixed(2) + ' seconds'
      });
    })
    .on('error', err => {
      console.error(err);
      res.status(500).json({ error: 'Failed to generate video' });
    })
    .run();
}



module.exports = {
  filterPics,
  generateVideoFromList
};
