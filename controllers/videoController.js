const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const videoRequestData = require('../data/videoRequestData');
const developerData = require('../data/developerData');
const projectData = require('../data/projectData');

const mediaRoot = process.env.MEDIA_PATH + '/upload';
let processing = false; // Global flag to check if a request is being processed



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
  const { developerId, projectId, cameraId, 
    date1, date2, hour1, hour2,
    duration
  } = req.body;

  const developer = developerData.getDeveloperByTag(developerId);
  const project = projectData.getProjectByTag(projectId);

  const developerName = developer[0].developerName;
  const projectName = project[0].projectName;
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

  let finalFrameRate = 25;
  if (duration) {
     finalFrameRate = Math.ceil(numFilteredPics / duration);
  }

  const startTime = Date.now();

  // Create a text file with paths to the filtered images
  const uniqueId = generateCustomId();
  const listFileName = `image_list_${uniqueId}.txt`;
  const listFilePath = path.join(videoFolderPath, listFileName);
  const fileListContent = filteredFiles.map(file => `file '${path.join(cameraPath, file)}'`).join('\n');
  fs.writeFileSync(listFilePath, fileListContent);

  // Log the request
  const logEntry = {
    "developerTag": developerId,
    "projectTag": projectId,
    "developer": developerName,
    "project": projectName,
    "camera": cameraId,
    "startDate": date1,
    "endDate": date2,
    "startHour": hour1,
    "endHour": hour2,
    "RequestTime": new Date().toISOString(),
    "filteredImageCount": numFilteredPics,
    "id": uniqueId,
    "listFile" : listFileName,
    "status": "queued"
  };
  const newRequest = logEntry;
  const addedRequest = videoRequestData.addItem(newRequest);
  processQueue();

  // Respond with filtered image count and the list file path
  res.json({
    message: 'Pictures filtered successfully',
    framerate: finalFrameRate,
    requestId: uniqueId,
    filteredImageCount: numFilteredPics
  });
}

function processQueue() {
  if (processing) return; // Skip if already processing another request

  // Get the next queued request
  const queuedRequest = videoRequestData.getAllItems().find((request) => request.status === 'queued');
  if (!queuedRequest) return; // No queued requests

  // Update the status to starting
  queuedRequest.status = 'starting';
  videoRequestData.updateItem(queuedRequest._id, { status: 'starting' });

  processing = true; // Mark as processing

  // Invoke generateVideoFromList
  const { developerTag, projectTag, camera, id: requestId, filteredImageCount } = queuedRequest;
  const frameRate = 25; // Example frame rate
  const requestPayload = {
    developerId: developerTag,
    projectId: projectTag,
    cameraId: camera,
    requestId,
    frameRate,
    picsCount: filteredImageCount,
  };

  generateVideoFromList(requestPayload, () => {
    // Mark the request as ready when done
    queuedRequest.status = 'ready';
    videoRequestData.updateItem(queuedRequest._id, { status: 'ready' });

    processing = false; // Mark as not processing

    // Process the next request in the queue
    processQueue();
  });
}


function generateVideoFromList(payload, callback) {
  const { developerId, projectId, cameraId, requestId, frameRate, picsCount} = payload;

  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'videos');
  const listFilePath = path.join(cameraPath, `image_list_${requestId}.txt` );
  const uniqueVideoName = `video_${requestId}.mp4`;
  const outputVideoPath = path.join(cameraPath, uniqueVideoName);

  const startTime = Date.now(); // Track the start time for measuring duration

  ffmpeg()
    .input(listFilePath)
    .inputOptions(['-f concat', '-safe 0', '-r ' + frameRate])
    .outputOptions([
      '-r ' + frameRate,
      '-c:v libx264',
      '-preset slow',
      '-crf 18',
      '-pix_fmt yuv420p'
    ])
    .output(outputVideoPath)
    .on('end', () => {
      const endTime = Date.now();
      const timeTaken = (endTime - startTime) / 1000;
      const videoLength = picsCount / frameRate;
      const fileSize = fs.statSync(outputVideoPath).size / (1024 * 1024);
      const videolog = {
        message: 'Video generated successfully',
        videoPath: outputVideoPath,
        filteredImageCount: picsCount,
        videoLength: videoLength.toFixed(2) + ' seconds',
        fileSize: fileSize.toFixed(2) + ' MB',
        timeTaken: timeTaken.toFixed(2) + ' seconds'
      }
      console.log(videolog);
      callback();
    })
    .on('error', err => {
      console.error(err);
      callback();
    })
    .run();
}

// Controller for getting all developers
function getAllVideoRequest(req, res) {
  const videoRequests = videoRequestData.getAllItems();
  res.json(videoRequests.map((request) => ({
    ...request,
    videoPath: request.status === 'ready' ? `/videos/${request.id}.mp4` : null,
  })));
}

function getVideoRequestbyDeveloper(req, res){
  const videoRequest = videoRequestData.getRequestByDeveloperTag(req.params.tag);
    if (videoRequest) {
        res.json(videoRequest);
    } else {
        res.status(404).json({ message: 'video Request not found' });
    }
}



module.exports = {
  filterPics,
  generateVideoFromList,
  getAllVideoRequest,
  getVideoRequestbyDeveloper
};
