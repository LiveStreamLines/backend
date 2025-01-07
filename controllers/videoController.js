const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const archiver = require('archiver');
const videoRequestData = require('../models/videoRequestData');
const photoRequestData = require('../models/photoRequestData');
const developerData = require('../models/developerData');
const projectData = require('../models/projectData');

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
 
  const developer_id = developer[0]._id;
  const developerName = developer[0].developerName;
  const project_id = project[0]._id;
  const projectName = project[0].projectName;

  // Define the camera folder path

  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId);
  const PicsPath = path.join(cameraPath, 'large');
  const videoFolderPath = path.join(cameraPath, 'videos');

  // Check if the camera directory exists
  if (!fs.existsSync(PicsPath)) {
    return res.status(404).json({ error: 'Camera directory not found' });
  }

  // Read all image files in the camera directory
  const allFiles = fs.readdirSync(PicsPath).filter(file => file.endsWith('.jpg'));

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
  const fileListContent = filteredFiles
  .map(file => `file '${path.join(PicsPath, file).replace(/\\/g, '/')}'`)
  .join('\n');  fs.writeFileSync(listFilePath, fileListContent);

  return {uniqueId, listFileName, numFilteredPics, developerName, projectName, developer_id, project_id};
}

function generateVideoRequest(req, res) {
  const { developerId, projectId, cameraId, 
    date1, date2, hour1, hour2,
    duration, showdate = false, showedText = '', 
    resolution = '720', music = 'false', musicFile='', contrast = '1.0', brightness = '0.0', saturation = '1.0'
  } = req.body;

  try {
    const { uniqueId, listFileName, numFilteredPics, developerName, projectName, developer_id, project_id } = filterImage({
      developerId, projectId, cameraId, date1, date2, hour1, hour2 });

      const logo = req.files?.logo ? req.files.logo[0].path : null;
      const showedWatermark = req.files?.showedWatermark ? req.files.showedWatermark[0].path : null;
  
    let finalFrameRate = 25;
    if (duration) {
      finalFrameRate = Math.ceil(numFilteredPics / duration);
    }

    const logEntry = {
      type: "video",
      developerID: developer_id,
      projectID: project_id,
      developerTag: developerId,
      projectTag: projectId,
      developer: developerName,
      project: projectName,
      camera: cameraId,
      startDate: date1,
      endDate: date2,
      startHour: hour1,
      endHour: hour2,
      id: uniqueId,
      listFile: listFileName,
      RequestTime: new Date().toISOString(),
      filteredImageCount: numFilteredPics,
      frameRate: finalFrameRate,
      resolution,
      showdate,
      showedText,
      showedWatermark,
      logo,
      music, musicFile,
      contrast, brightness, saturation,
      status: 'queued',
    };

    videoRequestData.addItem(logEntry);
    processQueue();

    res.json({
      message: 'Video request generated successfully',
      filteredImageCount: numFilteredPics,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

// Function to handle photo ZIP generation requests
function generatePhotoRequest(req, res) {
  const { developerId, projectId, cameraId, date1, date2, hour1, hour2 } = req.body;

  try {
    const { uniqueId, listFileName, numFilteredPics, developerName, projectName } = filterImage({
      developerId, projectId, cameraId, date1, date2, hour1, hour2});

    if (numFilteredPics === 0) {
      return res.status(404).json({ error: 'No pictures found for the specified filters' });
    }

    const logEntry = {
      type: "photo",
      developerTag: developerId,
      projectTag: projectId,
      developer: developerName,
      project: projectName,
      camera: cameraId,
      startDate: date1,
      endDate: date2,
      startHour: hour1,
      endHour: hour2,
      id: uniqueId,
      listFile: listFileName,
      RequestTime: new Date().toISOString(),
      filteredImageCount: numFilteredPics,
      status: 'queued',
    };

    photoRequestData.addItem(logEntry);
    processQueue();
    res.json({
      message: 'Photo request generated successfully',
      filteredImageCount: numFilteredPics,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
}

function processQueue() {
  if (processing) return; // Skip if already processing another request

  // Fetch queued requests from both video and photo request data
  const videoQueue = videoRequestData.getAllItems().find((request) => request.status === 'queued');
  const photoQueue = photoRequestData.getAllItems().find((request) => request.status === 'queued');

  // Determine the next request to process
  const queuedRequest = videoQueue || photoQueue;

  if (!queuedRequest) {
    console.log('No queued requests found.');
    return; // No queued requests
  }

  // Mark as processing
  processing = true;

  // Process the queued request based on its type
  if (queuedRequest.type === 'video') {
    processVideoRequest(queuedRequest);
  } else if (queuedRequest.type === 'photo') {
    processPhotoRequest(queuedRequest);
  } else {
    console.error(`Unknown request type: ${queuedRequest.type}`);
    processing = false;
  }

}

function processVideoRequest(queuedRequest) {
  // Update the status to starting
  console.log(`Starting video generation for request ID: ${queuedRequest._id}`);
  queuedRequest.status = 'starting';
  videoRequestData.updateItem(queuedRequest._id, { status: 'starting' });

  processing = true; // Mark as processing

  // Invoke generateVideoFromList
  const { developerTag, projectTag, camera, id: requestId, filteredImageCount, 
    frameRate, resolution, showdate, showedText, showedWatermark, logo, music, musicFile,
    contrast, brightness, saturation} = queuedRequest;

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
    logo,
    music, musicFile,
    contrast, brightness, saturation
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
  const { developerId, projectId, cameraId, requestId, frameRate, 
    resolution, showdate, showedText, showedWatermark, logo, music, musicFile,
    contrast, brightness, saturation,
  } = payload;

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
      fs.unlinkSync(listFilePath);
      if (logo) {
        fs.unlinkSync(logo);
      }
      if (showedWatermark) {
        fs.unlinkSync(showedWatermark);
      }
      concatenateVideos(partialVideos, outputVideoPath, music, musicFile, contrast, brightness, saturation, callback);
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
    const batchListPathl = batchListPath.replace(/\\/g, '/');
    const batchVideoPathl = batchVideoPath.replace(/\\/g, '/');
    const logopath = logo ? logo.replace(/\\/g, '/') : '';
    const watermarkpath = showedWatermark ? showedWatermark.replace(/\\/g, '/') : '';

    const resolutionMap = {
      '720': { width: 1280, height: 720 },
      'HD': { width: 1920, height: 1080 },
      '4K': { width: 3840, height: 2160 },
    };
    
    const selectedResolution = resolutionMap[resolution] || resolutionMap['HD']; // Default to HD if not specified
    
    const ffmpegCommand = ffmpeg()
      .input(batchListPathl)
      .inputOptions(['-f concat', '-safe 0', '-r ' + frameRate]);

    const drawtextFilters = [];
    let inputIndex = 0;
    
    const resolutionFilter = `[0:v]scale=${selectedResolution.width}:${selectedResolution.height}[scaled]`;
    drawtextFilters.push(resolutionFilter);
    let baseLabel = 'scaled';

    if (logo) {
      ffmpegCommand.input(logopath); // Add logo as an input
      drawtextFilters.push(`[${++inputIndex}:v]scale=200:-1[logo]`);
      drawtextFilters.push(`[${baseLabel}][logo]overlay=W-w-10:10[with_logo]`);
      baseLabel = 'with_logo';
    }

    if (showedWatermark) {
      ffmpegCommand.input(watermarkpath); // Add watermark as an input
      drawtextFilters.push(`[${++inputIndex}:v]format=rgba,colorchannelmixer=aa=0.2[watermark]`);
      drawtextFilters.push(`[${baseLabel}][watermark]overlay=W/2-w/2:H/2-h/2[with_watermark]`);
      baseLabel = 'with_watermark';
    }
   
    if (showdate === 'true' || showedText) {
      let combinedTextFilters = '';

      if (showdate === 'true') {
        const filterScriptContent = batchFiles.map((file, index) => {
          const fileName = path.basename(file);
          const fileDate = fileName.substring(0, 8);
          const formattedDate = `${fileDate.substring(0, 4)}-${fileDate.substring(4, 6)}-${fileDate.substring(6, 8)}`;
          return `drawtext=text='${formattedDate}':x=10:y=10:fontsize=60:fontcolor=white:box=1:boxcolor=black@0.5:enable='between(n,${index},${index})'`;
        }).join(',');
        combinedTextFilters += `${filterScriptContent}`;
      }

      if (showedText) {
        if (combinedTextFilters) combinedTextFilters += ',';
        combinedTextFilters += `drawtext=text='${showedText}':x=(w-text_w)/2:y=10:fontsize=60:fontcolor=white:box=1:boxcolor=black@0.5`;
      }
      
      drawtextFilters.push(`[${baseLabel}]${combinedTextFilters}`);
      baseLabel = 'final';
    }

    if (drawtextFilters.length === 1) {
       const dot = `[scaled]drawtext=text='.':x=10:y=10`;
       drawtextFilters.push(dot);
    }
    
    ffmpegCommand.addOption('-filter_complex', drawtextFilters.join(';'));

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
      .on('start', command => console.log(`FFmpeg Command for batch ${batchIndex}:${command}`))
      .on('end', () => {
        console.log(`Processed batch ${batchIndex + 1}/${batchCount}`);
        fs.unlinkSync(batchListPathl);
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


function concatenateVideos(videoPaths, outputVideoPath, useBackgroundMusic, musicFile, contrast, brightness, saturation, callback) {
  const concatListPath = path.join(path.dirname(outputVideoPath), `concat_list.txt`);
  const tempConcatenatedVideoPath = outputVideoPath.replace('.mp4', '_no_audio.mp4');
  const concatContent = videoPaths.map(video => `file '${video}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);

  // Step 1: Concatenate videos without re-encoding
  ffmpeg()
    .input(concatListPath)
    .inputOptions(['-f concat', '-safe 0'])
    .outputOptions(['-c copy'])
    .output(tempConcatenatedVideoPath)
    .on('end', () => {
      videoPaths.forEach(video => fs.unlinkSync(video)); // Clean up partial videos
      fs.unlinkSync(concatListPath); // Remove temporary list file

      // Step 2: Add visual effects and background music (if applicable)
      const backgroundMusicPath = path
        .join(process.env.MEDIA_PATH, '/music/',musicFile)
        .replace(/\\/g, '/'); 

      const ffmpegCommand = ffmpeg()
        .input(tempConcatenatedVideoPath); // Concatenated video input

      // Add background music if enabled
      if (useBackgroundMusic === 'true') {
        ffmpegCommand.input(backgroundMusicPath);
      }

      // Apply visual effects
      const visualEffects = `eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation}`;
      const filterComplex = `[0:v]${visualEffects}[video]`;

      
      ffmpegCommand
        .complexFilter(filterComplex)
        .map('[video]')
        .outputOptions([
          '-c:v libx264', // Re-encode video with effects
          '-preset slow',
          '-crf 18',
          '-pix_fmt yuv420p',
          ...(useBackgroundMusic === 'true' ? ['-map 1:a', '-shortest'] : [])
        ])
        .output(outputVideoPath)
        .on('start', command => {
          console.log('FFmpeg command:', command); // Log command for debugging
        })
        .on('end', () => {
          fs.unlinkSync(tempConcatenatedVideoPath); // Clean up temporary video file
          callback(null, { videoPath: outputVideoPath });
        })
        .on('error', err => {
          console.error('Error adding effects/music:', err);
          callback(err, null);
        })
        .run();
    })
    .on('error', err => {
      console.error('Error concatenating videos:', err);
      callback(err, null);
    })
    .run();
}


function processPhotoRequest(queuedRequest) {
  const { developerTag, projectTag, camera, id: requestId, listFile } = queuedRequest;

  const listFilePath = path.join(mediaRoot, developerTag, projectTag, camera, 'videos', listFile);
  const zipFilePath = path.join(mediaRoot, developerTag, projectTag, camera,'videos',`photos_${requestId}.zip`);

  const output = fs.createWriteStream(zipFilePath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => {
    console.error(`Error creating ZIP for request ID: ${requestId}`, err);
    photoRequestData.updateItem(queuedRequest._id, { status: 'failed' });
    processing = false;
    processQueue();
  });

  output.on('close', () => {
    console.log(`Photo ZIP created for request ID: ${requestId}, size: ${archive.pointer()} bytes`);
    photoRequestData.updateItem(queuedRequest._id, { status: 'ready', zipPath: zipFilePath });
    processing = false;
    processQueue();
  });

  archive.pipe(output);

  const filePaths = fs.readFileSync(listFilePath, 'utf-8')
    .split('\n')
    .map((line) => line.replace(/^file\s+'(.+)'$/, '$1').trim())
    .filter(Boolean);

  filePaths.forEach((filePath) => {
    if (fs.existsSync(filePath)) {
      archive.file(filePath, { name: path.basename(filePath) });
    } else {
      console.warn(`File not found: ${filePath}`);
    }
  });

  archive.finalize();
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

// Controller for getting all developers
function getAllPhotoRequest(req, res) {
  const photoRequests = photoRequestData.getAllItems();
  res.json(photoRequests.map((request) => ({
    ...request,
    zipPath: request.status === 'ready' ? `/videos/photos_${request.id}.zip` : null,
  })));
}

module.exports = {
  generateVideoRequest,
  generatePhotoRequest,
  getAllVideoRequest,
  getVideoRequestbyDeveloper,
  getAllPhotoRequest
};
