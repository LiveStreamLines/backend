const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const os = require('os');
const archiver = require('archiver');
const videoRequestData = require('../models/videoRequestData');
const photoRequestData = require('../models/photoRequestData');
const developerData = require('../models/developerData');
const projectData = require('../models/projectData');
const logger = require('../logger');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { createWriteStream } = require('fs');
const { pipeline } = require('stream/promises');


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
    throw new Error('Camera directory not found');
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
    throw new Error('No pictures found for the specified date and hour range');
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
    resolution = '720', music = 'false', musicFile='', 
    contrast = '1.0', brightness = '0.0', saturation = '1.0', 
    userId,
    userName
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
      progress: 0,
      progressMessage: 'Waiting in queue...',
      userId: userId,
      userName: userName
    };

    videoRequestData.addItem(logEntry);
    processQueue();

    res.json({
      message: 'Video request generated successfully',
      filteredImageCount: numFilteredPics,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ error: error.message });
  }
}

// Function to handle photo ZIP generation requests
function generatePhotoRequest(req, res) {
  const { developerId, projectId, cameraId, date1, date2, hour1, hour2, userId, userName } = req.body;

  try {
    const { uniqueId, listFileName, numFilteredPics, developerName, projectName, developer_id, project_id } = filterImage({
      developerId, projectId, cameraId, date1, date2, hour1, hour2});

    if (numFilteredPics === 0) {
      return res.status(404).json({ error: 'No pictures found for the specified filters' });
    }

    const logEntry = {
      type: "photo",
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
      status: 'queued',
      userId: userId,
      userName: userName
    };

    photoRequestData.addItem(logEntry);
    processQueue();
    res.json({
      message: 'Photo request generated successfully',
      filteredImageCount: numFilteredPics,
    });
  } catch (error) {
    logger.error(error);
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
    logger.info('No queued requests found.');
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
    logger.error(`Unknown request type: ${queuedRequest.type}`);
    processing = false;
  }

}

function processVideoRequest(queuedRequest) {
  // Update the status to starting
  logger.info(`Starting video generation for request ID: ${queuedRequest._id}`);
  queuedRequest.status = 'starting';
  videoRequestData.updateItem(queuedRequest._id, { 
    status: 'starting',
    progress: 0,
    progressMessage: 'Initializing video generation...'
  });

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

  processVideoInChunks(requestPayload, queuedRequest._id, (error, videoDetails) => {
    if (error) {
      logger.error(`Video generation failed for request ID: ${requestId}`);
      videoRequestData.updateItem(queuedRequest._id, { 
        status: 'failed',
        progress: 0,
        progressMessage: 'Video generation failed'
      });
    } else {
      logger.info(`Video generation completed for request ID: ${requestId}`);
       // Update the request with additional video details
       videoRequestData.updateItem(queuedRequest._id, {
        status: 'ready',
        progress: 100,
        progressMessage: 'Video generation completed',
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

function processVideoInChunks(payload, requestId, callback) {
  const { developerId, projectId, cameraId, requestId: requestIdFromPayload, frameRate, 
    resolution, showdate, showedText, showedWatermark, logo, music, musicFile,
    contrast, brightness, saturation,
  } = payload;

  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'videos');
  const outputVideoPath = path.join(cameraPath, `video_${requestIdFromPayload}.mp4`);
  const listFilePath = path.join(cameraPath, `image_list_${requestIdFromPayload}.txt`);
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
  
  // Update progress: Processing batches (0-80% of total progress)
  const updateBatchProgress = (batchIndex) => {
    const batchProgress = Math.floor((batchIndex / batchCount) * 80); // 80% for batch processing
    videoRequestData.updateItem(requestId, {
      status: 'processing',
      progress: batchProgress,
      progressMessage: `Processing batch ${batchIndex + 1} of ${batchCount} (${filteredFiles.length} images)`
    });
  };

  const processBatch = (batchIndex) => {
    
    if (batchIndex >= batchCount) {
      fs.unlinkSync(listFilePath);
      if (logo) {
        fs.unlinkSync(logo);
      }
      if (showedWatermark) {
        fs.unlinkSync(showedWatermark);
      }
      // Update progress: Starting concatenation (80%)
      videoRequestData.updateItem(requestId, {
        progress: 80,
        progressMessage: 'Concatenating video segments...'
      });
      concatenateVideos(partialVideos, outputVideoPath, music, musicFile, contrast, brightness, saturation, requestId, callback);
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
      .on('start', command => {
        logger.info(`FFmpeg Command for batch ${batchIndex}:${command}`);
        updateBatchProgress(batchIndex);
      })
      .on('end', () => {
        logger.info(`Processed batch ${batchIndex + 1}/${batchCount}`);
        fs.unlinkSync(batchListPathl);
        updateBatchProgress(batchIndex + 1);
        processBatch(batchIndex + 1);
      })
      .on('error', err => {
        logger.error(`Error processing batch ${batchIndex}:`, err);
        callback(err, null);
      })
      .run();
  };

  processBatch(0);
}


function concatenateVideos(videoPaths, outputVideoPath, useBackgroundMusic, musicFile, contrast, brightness, saturation, requestId, callback) {
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

      // Update progress: Applying effects (85%)
      videoRequestData.updateItem(requestId, {
        progress: 85,
        progressMessage: 'Applying visual effects and audio...'
      });

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
          logger.info('FFmpeg command:', command); // Log command for debugging
        })
        .on('progress', (progress) => {
          // Update progress during final encoding (85-95%)
          if (progress.percent) {
            const finalProgress = 85 + Math.floor((progress.percent / 100) * 10);
            videoRequestData.updateItem(requestId, {
              progress: Math.min(finalProgress, 95),
              progressMessage: 'Finalizing video...'
            });
          }
        })
        .on('end', () => {
          fs.unlinkSync(tempConcatenatedVideoPath); // Clean up temporary video file
          callback(null, { videoPath: outputVideoPath });
        })
        .on('error', err => {
          logger.error('Error adding effects/music:', err);
          callback(err, null);
        })
        .run();
    })
    .on('error', err => {
      logger.error('Error concatenating videos:', err);
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
    logger.error(`Error creating ZIP for request ID: ${requestId}`, err);
    photoRequestData.updateItem(queuedRequest._id, { status: 'failed' });
    processing = false;
    processQueue();
  });

  output.on('close', () => {
    logger.info(`Photo ZIP created for request ID: ${requestId}, size: ${archive.pointer()} bytes`);
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

// Controller for deleting a Project
function deleteVideoRequest(req, res) {
  const isDeleted = videoRequestData.deleteItem(req.params.id);
  if (isDeleted) {
      res.status(204).send();
  } else {
      res.status(404).json({ message: 'Project not found' });
  }
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

// S3 Configuration for Camera Pictures (same as cameraPicsControllerS3Test)
const S3_CONFIG = {
    endpoint: process.env.S3_CAMERA_ENDPOINT || 'https://s3.ap-southeast-1.idrivee2.com',
    region: process.env.S3_CAMERA_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.S3_CAMERA_ACCESS_KEY_ID || 'fMZXDwBL2hElR6rEzgCW',
        secretAccessKey: process.env.S3_CAMERA_SECRET_ACCESS_KEY || 'gXrfsUVEDttGQBv3GIfjZvokZ4qrAFsOUywiN4TD'
    },
    forcePathStyle: true,
    signatureVersion: 'v4'
};

const s3Client = new S3Client(S3_CONFIG);
const CAMERA_BUCKET_NAME = process.env.S3_CAMERA_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'camera-pictures';

/**
 * List all objects in S3 with the given prefix
 */
async function listS3Objects(prefix) {
    try {
        const objects = [];
        let continuationToken = undefined;

        do {
            const command = new ListObjectsV2Command({
                Bucket: CAMERA_BUCKET_NAME,
                Prefix: prefix,
                ContinuationToken: continuationToken,
                MaxKeys: 1000
            });

            const response = await s3Client.send(command);
            
            if (response.Contents) {
                objects.push(...response.Contents.map(obj => obj.Key));
            }

            continuationToken = response.NextContinuationToken;
        } while (continuationToken);

        return objects;
    } catch (error) {
        logger.error('Error listing S3 objects:', error);
        throw new Error(`Failed to list objects from S3: ${error.message}`);
    }
}

/**
 * Filter images by date and time range from S3
 * @param {string} developerId - Developer tag
 * @param {string} projectId - Project tag
 * @param {string} cameraId - Camera tag
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} startTime - Start time in HH format (00-23)
 * @param {string} endTime - End time in HH format (00-23)
 * @param {string} imageSize - 'optimized' or 'large'
 * @returns {Promise<string[]>} Array of S3 keys for filtered images
 */
async function filterS3ImagesByDateAndTime(developerId, projectId, cameraId, startDate, endDate, startTime, endTime, imageSize = 'large') {
    // Convert dates from YYYY-MM-DD to YYYYMMDD
    const startDateStr = startDate.replace(/-/g, '');
    const endDateStr = endDate.replace(/-/g, '');
    
    // Convert time from HH to HH format (pad with 0)
    const startTimeStr = String(startTime).padStart(2, '0');
    const endTimeStr = String(endTime).padStart(2, '0');
    
    // S3 prefix path
    const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/${imageSize}/`;
    
    // List all objects
    const objectKeys = await listS3Objects(s3Prefix);
    
    // Filter only .jpg files
    const jpgKeys = objectKeys.filter(key => key.endsWith('.jpg'));
    
    // Filter by date and time range
    const filteredKeys = jpgKeys.filter(key => {
        const filename = path.basename(key, '.jpg');
        
        // Extract date (YYYYMMDD) and hour (HH) from filename (format: YYYYMMDDHHmmss)
        if (filename.length < 10) return false;
        
        const fileDate = filename.substring(0, 8); // YYYYMMDD
        const fileHour = filename.substring(8, 10); // HH
        
        // Check date range
        const dateInRange = fileDate >= startDateStr && fileDate <= endDateStr;
        
        // Check time range
        const timeInRange = fileHour >= startTimeStr && fileHour <= endTimeStr;
        
        return dateInRange && timeInRange;
    });
    
    // Sort by filename (which is timestamp)
    filteredKeys.sort();
    
    return filteredKeys;
}

/**
 * Download images from S3 to local folder
 * @param {string[]} s3Keys - Array of S3 keys
 * @param {string} localFolder - Local folder path to save images
 * @returns {Promise<string[]>} Array of local file paths
 */
async function downloadImagesFromS3(s3Keys, localFolder) {
    // Ensure folder exists
    if (!fs.existsSync(localFolder)) {
        fs.mkdirSync(localFolder, { recursive: true });
    }
    
    const localPaths = [];
    
    for (let i = 0; i < s3Keys.length; i++) {
        const s3Key = s3Keys[i];
        const filename = path.basename(s3Key);
        const localPath = path.join(localFolder, `${String(i + 1).padStart(6, '0')}_${filename}`);
        
        try {
            const getObjectCommand = new GetObjectCommand({
                Bucket: CAMERA_BUCKET_NAME,
                Key: s3Key
            });
            
            const response = await s3Client.send(getObjectCommand);
            const writeStream = createWriteStream(localPath);
            await pipeline(response.Body, writeStream);
            
            localPaths.push(localPath);
        } catch (error) {
            logger.error(`Error downloading ${s3Key}:`, error);
            // Continue with other images
        }
    }
    
    return localPaths;
}

/**
 * Calculate estimated video time based on number of images and speed
 * @param {number} imageCount - Number of images
 * @param {string} speed - 'fast', 'regular', or 'slow'
 * @returns {number} Estimated video duration in seconds
 */
function calculateEstimatedVideoTime(imageCount, speed) {
    // Frame rates for different speeds
    const frameRates = {
        'fast': 30,    // 30 fps - faster playback
        'regular': 15, // 15 fps - normal playback
        'slow': 5      // 5 fps - slower playback
    };
    
    const fps = frameRates[speed] || frameRates['regular'];
    const duration = imageCount / fps;
    
    return Math.round(duration);
}

/**
 * Generate video from S3 images with all parameters
 */
async function generateVideoFromS3(req, res) {
    try {
        const {
            developerId,
            projectId,
            cameraId,
            startDate,      // YYYY-MM-DD format
            endDate,        // YYYY-MM-DD format
            startTime,      // HH format (00-23)
            endTime,        // HH format (00-23)
            showDate = false,           // boolean or 'true'/'false' string
            topText = '',               // Text to show in top middle
            logoPath = '',              // Path to logo image (right up corner) - optional if uploaded
            watermarkPath = '',        // Path to watermark image (middle) - optional if uploaded
            brightness = 0.0,           // Brightness adjustment (-1.0 to 1.0)
            contrast = 1.0,            // Contrast adjustment (0.0 to 3.0)
            saturation = 1.0,           // Saturation adjustment (0.0 to 3.0)
            resolution = '720',         // '720' or '4K'
            speed = 'regular',          // 'fast', 'regular', or 'slow'
            imageSize = 'large'         // 'optimized' or 'large'
        } = req.body;
        
        // Get uploaded files if any
        const logoFile = req.files?.logo ? req.files.logo[0].path : null;
        const watermarkFile = req.files?.watermark ? req.files.watermark[0].path : null;
        
        // Use uploaded files if available, otherwise use provided paths
        const finalLogoPath = logoFile || logoPath;
        const finalWatermarkPath = watermarkFile || watermarkPath;
        
        // Validate required parameters
        if (!developerId || !projectId || !cameraId || !startDate || !endDate || !startTime || !endTime) {
            return res.status(400).json({
                error: 'Missing required parameters: developerId, projectId, cameraId, startDate, endDate, startTime, endTime'
            });
        }
        
        logger.info(`Generating video from S3: ${developerId}/${projectId}/${cameraId} from ${startDate} ${startTime}:00 to ${endDate} ${endTime}:00`);
        
        // Step 1: Filter images from S3
        const s3Keys = await filterS3ImagesByDateAndTime(
            developerId, projectId, cameraId, 
            startDate, endDate, startTime, endTime, imageSize
        );
        
        if (s3Keys.length === 0) {
            return res.status(404).json({
                error: 'No images found for the specified date and time range'
            });
        }
        
        logger.info(`Found ${s3Keys.length} images matching criteria`);
        
        // Step 2: Calculate estimated video time
        const estimatedDuration = calculateEstimatedVideoTime(s3Keys.length, speed);
        
        // Step 3: Download images to temporary folder
        const tempFolder = path.join(
            process.env.MEDIA_PATH || './media',
            'upload',
            developerId,
            projectId,
            cameraId,
            'temp_video',
            `video_${Date.now()}`
        );
        
        logger.info(`Downloading ${s3Keys.length} images to ${tempFolder}`);
        const localImagePaths = await downloadImagesFromS3(s3Keys, tempFolder);
        
        if (localImagePaths.length === 0) {
            return res.status(500).json({
                error: 'Failed to download images from S3'
            });
        }
        
        logger.info(`Downloaded ${localImagePaths.length} images`);
        
        // Step 4: Prepare output video path
        const videoFolder = path.join(
            process.env.MEDIA_PATH || './media',
            'upload',
            developerId,
            projectId,
            cameraId,
            'videos'
        );
        
        if (!fs.existsSync(videoFolder)) {
            fs.mkdirSync(videoFolder, { recursive: true });
        }
        
        const videoId = generateCustomId();
        const outputVideoPath = path.join(videoFolder, `video_s3_${videoId}.mp4`);
        
        // Step 5: Create image list file for ffmpeg
        const listFilePath = path.join(tempFolder, 'image_list.txt');
        const fileListContent = localImagePaths
            .map(file => `file '${file.replace(/\\/g, '/')}'`)
            .join('\n');
        fs.writeFileSync(listFilePath, fileListContent);
        
        // Step 6: Configure resolution
        const resolutionMap = {
            '720': { width: 1280, height: 720 },
            '4K': { width: 3840, height: 2160 }
        };
        const selectedResolution = resolutionMap[resolution] || resolutionMap['720'];
        
        // Step 7: Configure frame rate based on speed
        const frameRates = {
            'fast': 30,
            'regular': 15,
            'slow': 5
        };
        const fps = frameRates[speed] || frameRates['regular'];
        
        // Step 8: Build ffmpeg command with all filters
        const ffmpegCommand = ffmpeg()
            .input(listFilePath)
            .inputOptions(['-f concat', '-safe 0', `-r ${fps}`]);
        
        const drawtextFilters = [];
        let inputIndex = 0;
        
        // Scale to resolution
        const resolutionFilter = `[0:v]scale=${selectedResolution.width}:${selectedResolution.height}[scaled]`;
        drawtextFilters.push(resolutionFilter);
        let baseLabel = 'scaled';
        
        // Add logo (right up corner) if provided
        if (finalLogoPath && fs.existsSync(finalLogoPath)) {
            const logoPathNormalized = finalLogoPath.replace(/\\/g, '/');
            ffmpegCommand.input(logoPathNormalized);
            drawtextFilters.push(`[${++inputIndex}:v]scale=200:-1[logo]`);
            drawtextFilters.push(`[${baseLabel}][logo]overlay=W-w-10:10[with_logo]`);
            baseLabel = 'with_logo';
        }
        
        // Add watermark (middle) if provided
        if (finalWatermarkPath && fs.existsSync(finalWatermarkPath)) {
            const watermarkPathNormalized = finalWatermarkPath.replace(/\\/g, '/');
            ffmpegCommand.input(watermarkPathNormalized);
            drawtextFilters.push(`[${++inputIndex}:v]format=rgba,colorchannelmixer=aa=0.2[watermark]`);
            drawtextFilters.push(`[${baseLabel}][watermark]overlay=W/2-w/2:H/2-h/2[with_watermark]`);
            baseLabel = 'with_watermark';
        }
        
        // Build text filters for date and top text
        let textFilters = [];
        
        // Add date/time overlay if enabled
        if (showDate === true || showDate === 'true') {
            // Create date filters for each frame
            const dateFilters = localImagePaths.map((file, index) => {
                const filename = path.basename(file);
                // Extract timestamp from filename (format: 000001_YYYYMMDDHHmmss.jpg)
                const timestampMatch = filename.match(/\d{14}/);
                if (timestampMatch) {
                    const timestamp = timestampMatch[0];
                    const dateStr = timestamp.substring(0, 8);
                    const timeStr = timestamp.substring(8, 14);
                    const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                    const formattedTime = `${timeStr.substring(0, 2)}:${timeStr.substring(2, 4)}:${timeStr.substring(4, 6)}`;
                    // Escape single quotes in text
                    const escapedText = `${formattedDate} ${formattedTime}`.replace(/'/g, "\\'");
                    return `drawtext=text='${escapedText}':x=10:y=10:fontsize=60:fontcolor=white:box=1:boxcolor=black@0.5:enable='between(n,${index},${index})'`;
                }
                return '';
            }).filter(f => f.length > 0);
            
            textFilters = textFilters.concat(dateFilters);
        }
        
        // Add top text if provided (position it below date if date is shown, or at top if not)
        if (topText && topText.trim()) {
            const escapedText = topText.replace(/'/g, "\\'");
            // Position top text in center, adjust y position based on whether date is shown
            const yPosition = (showDate === true || showDate === 'true') ? 80 : 10;
            textFilters.push(`drawtext=text='${escapedText}':x=(w-text_w)/2:y=${yPosition}:fontsize=60:fontcolor=white:box=1:boxcolor=black@0.5`);
        }
        
        // Apply all text filters
        if (textFilters.length > 0) {
            drawtextFilters.push(`[${baseLabel}]${textFilters.join(',')}[with_text]`);
            baseLabel = 'with_text';
        }
        
        // Apply brightness, contrast, saturation
        const effectsFilter = `[${baseLabel}]eq=contrast=${contrast}:brightness=${brightness}:saturation=${saturation}[final]`;
        drawtextFilters.push(effectsFilter);
        
        // Apply filter complex
        if (drawtextFilters.length > 0) {
            ffmpegCommand.addOption('-filter_complex', drawtextFilters.join(';'));
            ffmpegCommand.map('[final]');
        }
        
        // Step 9: Generate video
        ffmpegCommand
            .outputOptions([
                `-r ${fps}`,
                '-c:v libx264',
                '-preset slow',
                '-crf 18',
                '-pix_fmt yuv420p'
            ])
            .output(outputVideoPath)
            .on('start', (command) => {
                logger.info('FFmpeg command:', command);
            })
            .on('progress', (progress) => {
                logger.info(`Video generation progress: ${progress.percent || 0}%`);
            })
            .on('end', () => {
                logger.info('Video generation completed');
                
                // Get video file size
                const stats = fs.statSync(outputVideoPath);
                const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                
                // Clean up temporary folder and uploaded files
                try {
                    fs.rmSync(tempFolder, { recursive: true, force: true });
                    logger.info(`Cleaned up temporary folder: ${tempFolder}`);
                    
                    // Clean up uploaded logo and watermark files
                    if (logoFile && fs.existsSync(logoFile)) {
                        fs.unlinkSync(logoFile);
                    }
                    if (watermarkFile && fs.existsSync(watermarkFile)) {
                        fs.unlinkSync(watermarkFile);
                    }
                } catch (cleanupError) {
                    logger.error('Error cleaning up temp folder:', cleanupError);
                }
                
                // Return success response
                res.json({
                    success: true,
                    message: 'Video generated successfully',
                    videoId: videoId,
                    videoPath: `/media/upload/${developerId}/${projectId}/${cameraId}/videos/video_s3_${videoId}.mp4`,
                    imageCount: localImagePaths.length,
                    estimatedDuration: estimatedDuration,
                    actualDuration: estimatedDuration, // Could be calculated from video metadata
                    fileSize: `${fileSizeMB} MB`,
                    resolution: resolution,
                    speed: speed,
                    fps: fps
                });
            })
            .on('error', (err) => {
                logger.error('Error generating video:', err);
                
                // Clean up on error
                try {
                    if (fs.existsSync(tempFolder)) {
                        fs.rmSync(tempFolder, { recursive: true, force: true });
                    }
                    // Clean up uploaded files on error
                    if (logoFile && fs.existsSync(logoFile)) {
                        fs.unlinkSync(logoFile);
                    }
                    if (watermarkFile && fs.existsSync(watermarkFile)) {
                        fs.unlinkSync(watermarkFile);
                    }
                } catch (cleanupError) {
                    logger.error('Error cleaning up temp folder:', cleanupError);
                }
                
                res.status(500).json({
                    error: 'Failed to generate video',
                    message: err.message
                });
            })
            .run();
            
    } catch (error) {
        logger.error('Error in generateVideoFromS3:', error);
        res.status(500).json({
            error: 'Failed to generate video',
            message: error.message
        });
    }
}

module.exports = {
  generateVideoRequest,
  generatePhotoRequest,
  getAllVideoRequest,
  getVideoRequestbyDeveloper,
  getAllPhotoRequest,
  deleteVideoRequest,
  generateVideoFromS3
};
