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

function filterImage({ developerId, projectId, cameraId, date1, date2, hour1, hour2 })
{
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

   // Create a text file with paths to the filtered images
  const uniqueId = generateCustomId();
  const listFileName = `image_list_${uniqueId}.txt`;
  const listFilePath = path.join(videoFolderPath, listFileName);
  const fileListContent = filteredFiles.map(file => `file '${path.join(cameraPath, file)}'`).join('\n');
  fs.writeFileSync(listFilePath, fileListContent);

  return {uniqueId, listFileName, numFilteredPics, developerName, projectName};
}

function filterPics(req, res) {
  const { developerId, projectId, cameraId, 
    date1, date2, hour1, hour2,
    duration, showdate = false, showedText = '', showedWatermark = '', resolution = '720'
  } = req.body;

  const {uniqueId, listFileName, numFilteredPics, developerName, projectName} = filterImage({ developerId, projectId, cameraId, date1, date2, hour1, hour2 });

  const logo = req.file ? req.file.path : null;
 
  let finalFrameRate = 25;
  if (duration) {
     finalFrameRate = Math.ceil(numFilteredPics / duration);
  }

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
    "id": uniqueId,
    "listFile" : listFileName,
    "RequestTime": new Date().toISOString(),
    "filteredImageCount": numFilteredPics,
    "frameRate": finalFrameRate,
    resolution,
    showdate,
    showedText,
    showedWatermark,
    logo: logo,
    "status": "queued"
  };
  const newRequest = logEntry;
  const addedRequest = videoRequestData.addItem(newRequest);
  processQueue();

  // Respond with filtered image count and the list file path
  res.json({
    message: 'Pictures filtered successfully',
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
  const { developerTag, projectTag, camera, id: requestId, filteredImageCount, 
          frameRate, resolution, showdate, showedText, showedWatermark, logo } = queuedRequest;
  const requestPayload = {
    developerId: developerTag,
    projectId: projectTag,
    cameraId: camera,
    requestId,
    frameRate,
    picsCount: filteredImageCount,
    resolution,
    showdate,
    showedText,
    showedWatermark,
    logo
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
  const { developerId, projectId, cameraId, requestId, frameRate, resolution, showdate, showedText, showedWatermark, logo } = payload;

  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'videos');
  const outputVideoPath = path.join(cameraPath, `video_${requestId}.mp4`);
  const listFilePath = path.join(cameraPath, `image_list_${requestId}.txt`);
  const partialVideos = [];

  // Read `filteredFiles` dynamically from the text file
  if (!fs.existsSync(listFilePath)) {
    return callback(new Error(`List file not found: ${listFilePath}`), null);
  }

  const filteredFiles = fs
    .readFileSync(listFilePath, 'utf-8')
    .split('\n')
    .map(line => line.replace(/^file\s+'(.+)'$/, '$1').trim())
    .filter(Boolean);

  const batchCount = Math.ceil(filteredFiles.length / batchSize);

  const processBatch = (batchIndex) => {
    if (batchIndex >= batchCount) {
      concatenateVideos(partialVideos, outputVideoPath, callback);
      return;
    }

    const batchFiles = filteredFiles.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);
    if (batchFiles.length === 0) {
      processBatch(batchIndex + 1);
      return;
    }

    const batchListPath = path.join(cameraPath, `batch_list_${requestId}_${batchIndex}.txt`);
    const batchVideoPath = path.join(cameraPath, `batch_video_${requestId}_${batchIndex}.mp4`);
    partialVideos.push(batchVideoPath);

    // Corrected: Use file paths directly
    const fileListContent = batchFiles.map(file => `file '${file}'`).join('\n');
    fs.writeFileSync(batchListPath, fileListContent);

    // Log for debugging
    console.log(`Batch list file for batch ${batchIndex}:`);
    const batchListPathl = batchListPath.replace(/\\/g, '/');
    const batchVideoPathl = batchVideoPath.replace(/\\/g, '/');

    //console.log(logo);

    const resolutionMap = {
      '720': { width: 1280, height: 720 },
      'HD': { width: 1920, height: 1080 },
      '4K': { width: 3840, height: 2160 },
    };
    
    const selectedResolution = resolutionMap[resolution] || resolutionMap['HD']; // Default to HD if not specified
    const resolutionWidth = selectedResolution.width;
    const resolutionHeight = selectedResolution.height;
    

    const ffmpegCommand = ffmpeg()
      .input(batchListPathl)
      .inputOptions(['-f concat', '-safe 0', '-r ' + frameRate]);

    if (logo) {
      const logol = logo.replace(/\\/g, '/');
      ffmpegCommand.input(logol);
    }

    let addFilterComplex = false; // Track if we need to add -filter_complex
    const drawtextFilters = [];

    // Ensure the input video dimensions are divisible by 2
    drawtextFilters.push(`[0:v]scale=${resolutionWidth}:${resolutionHeight}[scaled]`);

    // Build the combined filter chain
    let combinedFilters = '';
    let logotext = '';
    // Add filters dynamically based on options
    if (showdate === 'true') {
      const filterScriptPath = path.join(cameraPath, `batch_filter_${requestId}_${batchIndex}.txt`);
      const filterScriptContent = batchFiles.map((file, index) => {
        const fileName = path.basename(file);
        const fileDate = fileName.substring(0, 8);
        const formattedDate = `${fileDate.substring(0, 4)}-${fileDate.substring(4, 6)}-${fileDate.substring(6, 8)}`;
        return `drawtext=text='${formattedDate}':x=10:y=10:fontsize=60:fontcolor=white:box=1:boxcolor=black@0.5:enable='between(n,${index},${index})'`;
      }).join(',');
      

      // filterScriptPathl = filterScriptPath.replace(/\\/g, '/');
      fs.writeFileSync(filterScriptPath, filterScriptContent);
      //combinedFilters += `drawtext=textfile='${filterScriptPathl}'`;
      combinedFilters += `${filterScriptContent}`;
      addFilterComplex = true;
    }

    if (showedText) {
      if (combinedFilters) combinedFilters += ',';
      combinedFilters += `drawtext=text='${showedText}':x=(w-text_w)/2:y=10:fontsize=60:fontcolor=white:box=1:boxcolor=black@0.5`;
      addFilterComplex = true;
    }

    if (showedWatermark) {
      if (combinedFilters) combinedFilters += ',';
      combinedFilters += `drawtext=text='${showedWatermark}':x=w/2-text_w/2:y=h/2-text_h/2:fontsize=120:fontcolor=white:alpha=0.3:borderw=2:bordercolor=black`;
      addFilterComplex = true;
    }

    let nologo = true;
    // Add combined filters to the filter_complex
    if (combinedFilters.trim() !== "") {
      if (logo) {
        drawtextFilters.push(`[scaled]${combinedFilters}[base]`);
      }
      else {
        drawtextFilters.push(`[scaled]${combinedFilters}`);
      }
    } else {
      if (logo) {
        drawtextFilters.push(`[1:v]scale=200:200[logo];[scaled][logo]overlay=W-w-10:10`);
        nologo = false;
        addFilterComplex = true
      }
    }

    // Add logo overlay if needed
    if (logo && nologo) {
      drawtextFilters.push(`[1:v]scale=200:200[logo];[base][logo]overlay=W-w-10:10`);
      addFilterComplex = true;
    }

    // Apply the filter_complex if filters are added
    if (addFilterComplex) {
      const filterComplexString = `${drawtextFilters.join(';')}`;
      ffmpegCommand.addOption('-filter_complex', filterComplexString);
    }

    // Add output options
    ffmpegCommand
      .outputOptions([
        '-r ' + frameRate,
        '-c:v libx264',
        '-preset slow',
        '-crf 18',
        '-pix_fmt yuv420p',
      ])
      .output(batchVideoPathl)
      .on('start', command => console.log(`FFmpeg Command for batch ${batchIndex}: ${command}`))
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
