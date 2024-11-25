const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const videoRequestData = require('../data/videoRequestData');
const developerData = require('../data/developerData');
const projectData = require('../data/projectData');

const mediaRoot = process.env.MEDIA_PATH + '/upload';
const batchSize = 200; // Number of images per batch for processing

let processing = false; // Global flag to check if a request is being processed



function generateCustomId() {
  return Array.from(Array(24), () => Math.floor(Math.random() * 16).toString(16)).join('');
}

function filterPics(req, res) {
  const { developerId, projectId, cameraId, 
    date1, date2, hour1, hour2,
    duration, showdate = true
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
    "frameRate": finalFrameRate,
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
  if (!queuedRequest) {
    console.log('No queued requests found.');
    return; // No queued requests
  }

  // Update the status to starting
  console.log(`Starting video generation for request ID: ${queuedRequest._id}`);
  queuedRequest.status = 'starting';
  videoRequestData.updateItem(queuedRequest._id, { status: 'starting' });

  processing = true; // Mark as processing

  // Invoke generateVideoFromList
  const { developerTag, projectTag, camera, id: requestId, filteredImageCount, frameRate } = queuedRequest;
  const requestPayload = {
    developerId: developerTag,
    projectId: projectTag,
    cameraId: camera,
    requestId,
    frameRate,
    picsCount: filteredImageCount,
    showdate: true
  };

  processVideoInChunks(requestPayload, (error, videoDetails) => {
    if (error) {
      console.error(`Video generation failed for request ID: ${requestId}`);
      videoRequestData.updateItem(queuedRequest._id, { status: 'failed' });
    } else {
      console.log(`Video generation completed for request ID: ${requestId}`);
       // Update the request with additional video details
       videoRequestData.updateItem(queuedRequest._id, {
        status: 'ready',
        videoPath: videoDetails.videoPath,
        videoLength: videoDetails.videoLength,
        fileSize: videoDetails.fileSize,
        timeTaken: videoDetails.timeTaken,
      });
    }
    processing = false; // Mark as not processing

    // Process the next request in the queue
    processQueue();
  });
}


function processVideoInChunks(payload, callback) {
  const { developerId, projectId, cameraId, requestId, frameRate, picsCount, showdate} = payload;

  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'videos');
  const outputVideoPath = path.join(cameraPath, `video_${requestId}.mp4`);
  const partialVideos = [];
  const batchCount = Math.ceil(picsCount / batchSize);

  const processBatch = (batchIndex) => {
    if (batchIndex >= batchCount) {
      concatenateVideos(partialVideos, outputVideoPath, callback);
      return;
    }

    const batchListPath = path.join(cameraPath, `batch_list_${requestId}_${batchIndex}.txt`);
    const batchFiles = filteredFiles.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
    const fileListContent = batchFiles.map(file => `file '${path.join(cameraPath, file)}'`).join('\n');
    fs.writeFileSync(batchListPath, fileListContent);

    const batchVideoPath = path.join(cameraPath, `batch_video_${requestId}_${batchIndex}.mp4`);
    partialVideos.push(batchVideoPath);

    const ffmpegCommand = ffmpeg()
      .input(batchListPath)
      .inputOptions(['-f concat', '-safe 0', '-r ' + frameRate])
      .outputOptions([
        '-r ' + frameRate,
        '-c:v libx264',
        '-preset slow',
        '-crf 18',
        '-pix_fmt yuv420p',
      ]);

    if (showdate) {
      const filterScriptPath = path.join(cameraPath, `batch_filter_${requestId}_${batchIndex}.txt`);
      const filterScriptContent = batchFiles.map((file, index) => {
        const fileDate = file.substring(0, 8);
        const formattedDate = `${fileDate.substring(0, 4)}-${fileDate.substring(4, 6)}-${fileDate.substring(6, 8)}`;
        return `drawtext=text='${formattedDate}':x=10:y=10:fontsize=60:fontcolor=white:box=1:boxcolor=black@0.5:enable='between(n,${index},${index})'`;
      }).join(',');

      fs.writeFileSync(filterScriptPath, filterScriptContent);
      ffmpegCommand.complexFilter(filterScriptContent);
    }

    ffmpegCommand
      .output(batchVideoPath)
      .on('end', () => {
        console.log(`Processed batch ${batchIndex + 1}/${batchCount}`);
        processBatch(batchIndex + 1);
      })
      .on('error', err => {
        console.error(`Error processing batch ${batchIndex}:`, err);
        callback(err, null);
      })
      .run();
  };

  processBatch(0);

}

function concatenateVideos(videoPaths, outputVideoPath, callback) {
  const concatListPath = path.join(path.dirname(outputVideoPath), `concat_list.txt`);
  const concatContent = videoPaths.map(video => `file '${video}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  ffmpeg()
    .input(concatListPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy'])
    .output(outputVideoPath)
    .on('end', () => {
      videoPaths.forEach(video => fs.unlinkSync(video));
      fs.unlinkSync(concatListPath);
      callback(null, { videoPath: outputVideoPath });
    })
    .on('error', err => {
      console.error('Error concatenating videos:', err);
      callback(err, null);
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
  getAllVideoRequest,
  getVideoRequestbyDeveloper
};
