const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../logger');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// S3 Configuration for Camera Pictures
// You can override these with environment variables
const S3_CONFIG = {
    endpoint: process.env.S3_CAMERA_ENDPOINT || 'https://s3.ap-southeast-1.idrivee2.com',
    region: process.env.S3_CAMERA_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.S3_CAMERA_ACCESS_KEY_ID || 'fMZXDwBL2hElR6rEzgCW',
        secretAccessKey: process.env.S3_CAMERA_SECRET_ACCESS_KEY || 'gXrfsUVEDttGQBv3GIfjZvokZ4qrAFsOUywiN4TD'
    },
    forcePathStyle: true, // Required for custom S3-compatible services
    signatureVersion: 'v4'
};

// Initialize S3 Client for camera pictures
const s3Client = new S3Client(S3_CONFIG);

// S3 Bucket name for camera pictures (can be different from attachments bucket)
const CAMERA_BUCKET_NAME = process.env.S3_CAMERA_BUCKET_NAME || process.env.S3_BUCKET_NAME || 'camera-pictures';

// Presigned URL expiration (7 days)
const PRESIGNED_URL_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * List all objects in S3 with the given prefix
 * @param {string} prefix - S3 key prefix (e.g., "upload/developer1/project1/camera1/large/")
 * @returns {Promise<string[]>} Array of object keys (filenames)
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
                MaxKeys: 1000 // Limit per page for better performance
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
 * Get only the last image for a camera (optimized - doesn't list all objects)
 * Uses pagination to get to the last page efficiently
 */
async function getLastImageOnly(prefix) {
    try {
        let lastKey = null;
        let continuationToken = undefined;
        let hasMore = true;

        // Paginate through to get the last page
        while (hasMore) {
            const command = new ListObjectsV2Command({
                Bucket: CAMERA_BUCKET_NAME,
                Prefix: prefix,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });

            const response = await s3Client.send(command);
            
            if (response.Contents && response.Contents.length > 0) {
                // Filter .jpg files and get the last one from this page
                const jpgKeys = response.Contents
                    .map(obj => obj.Key)
                    .filter(key => key.endsWith('.jpg'))
                    .sort();
                
                if (jpgKeys.length > 0) {
                    lastKey = jpgKeys[jpgKeys.length - 1];
                }
            }

            continuationToken = response.NextContinuationToken;
            hasMore = !!continuationToken;
        }

        if (lastKey) {
            return extractFilename(lastKey);
        }

        return '';
    } catch (error) {
        logger.error('Error getting last image only:', error);
        return '';
    }
}

/**
 * Generate presigned URL for an S3 object
 * @param {string} key - S3 object key
 * @returns {Promise<string>} Presigned URL
 */
async function getPresignedUrl(key) {
    try {
        const command = new GetObjectCommand({
            Bucket: CAMERA_BUCKET_NAME,
            Key: key
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn: PRESIGNED_URL_EXPIRY });
        return url;
    } catch (error) {
        logger.error('Error generating presigned URL:', error);
        throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
}

/**
 * Extract filename from S3 key
 * @param {string} key - Full S3 key (e.g., "upload/dev1/proj1/cam1/large/20240101120000.jpg")
 * @returns {string} Filename (e.g., "20240101120000")
 */
function extractFilename(key) {
    const filename = path.basename(key, '.jpg');
    return filename;
}

// Controller function to get camera pictures from S3
async function getCameraPictures(req, res) {
    try {
        const { developerId, projectId, cameraId } = req.params;
        const { date1, date2 } = req.body; // Optional date filters in the format YYYYMMDD

        // S3 prefix path: upload/{developerId}/{projectId}/{cameraId}/large/
        const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;

        // OPTIMIZATION: If no date filters, use faster method to get only first and last
        if (!date1 && !date2) {
            // Get first image (first page, first object)
            const firstCommand = new ListObjectsV2Command({
                Bucket: CAMERA_BUCKET_NAME,
                Prefix: s3Prefix,
                MaxKeys: 1
            });
            
            const firstResponse = await s3Client.send(firstCommand);
            let firstPic = '';
            if (firstResponse.Contents && firstResponse.Contents.length > 0) {
                const firstKey = firstResponse.Contents[0].Key;
                if (firstKey.endsWith('.jpg')) {
                    firstPic = extractFilename(firstKey);
                }
            }

            // Get last image using optimized pagination
            const lastPic = await getLastImageOnly(s3Prefix);

            if (!firstPic && !lastPic) {
                return res.json({ error: 'No pictures found in camera directory' });
            }

            return res.json({
                firstPhoto: firstPic,
                lastPhoto: lastPic,
                date1Photos: [],
                date2Photos: [],
                path: `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/`
            });
        }

        // If date filters are provided, we need to list all objects (slower but necessary)
        const objectKeys = await listS3Objects(s3Prefix);

        // Filter only .jpg files
        const jpgKeys = objectKeys.filter(key => key.endsWith('.jpg'));

        if (jpgKeys.length === 0) {
            return res.json({ error: 'No pictures found in camera directory' });
        }

        // Extract filenames and sort
        const files = jpgKeys.map(key => extractFilename(key));
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
            firstPhoto: firstPic,
            lastPhoto: lastPic,
            date1Photos: date1Files,
            date2Photos: date2Files,
            path: `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/`
        });
    } catch (error) {
        logger.error('Error in getCameraPictures (S3):', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Helper function to get weekly images from S3
 * @param {string} s3Prefix - S3 prefix path
 * @returns {Promise<string[]>} Array of full S3 keys for weekly images
 */
async function getWeeklyImages(s3Prefix) {
    const objectKeys = await listS3Objects(s3Prefix);
    const jpgKeys = objectKeys.filter(key => key.endsWith('.jpg'));

    if (jpgKeys.length === 0) {
        throw new Error('No pictures found in camera directory');
    }

    // Extract filenames and sort
    const files = jpgKeys.map(key => extractFilename(key));
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
            // Find the corresponding S3 key
            const weeklyKey = jpgKeys.find(key => extractFilename(key) === weeklyFiles[0]);
            if (weeklyKey) {
                weeklyImages.push(weeklyKey);
            }
        }

        currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    if (weeklyImages.length === 0) {
        throw new Error('No weekly images found');
    }

    return weeklyImages;
}

async function getCameraPreview(req, res) {
    try {
        const { developerId, projectId, cameraId } = req.params;
        const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;

        const weeklyImageKeys = await getWeeklyImages(s3Prefix);

        // Extract image filenames (without extensions)
        const weeklyImageNames = weeklyImageKeys.map(key => extractFilename(key));

        res.json({
            weeklyImages: weeklyImageNames,
            path: `${req.protocol}://${req.get('host')}/media/upload/${developerId}/${projectId}/${cameraId}/`
        });
    } catch (error) {
        logger.error('Error in getCameraPreview (S3):', error);
        res.status(404).json({ error: error.message });
    }
}

async function generateWeeklyVideo(req, res) {
    const { developerId, projectId, cameraId } = req.params;
    const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;
    const outputPath = path.join(process.env.MEDIA_PATH || './media', 'upload', developerId, projectId, cameraId, 'weekly_video.mp4');

    try {
        const weeklyImageKeys = await getWeeklyImages(s3Prefix);

        if (weeklyImageKeys.length < 2) {
            return res.status(400).json({ error: 'Not enough images to generate a video.' });
        }

        // Download images from S3 to a temporary directory
        const tempDir = path.join(process.env.MEDIA_PATH || './media', 'upload', developerId, projectId, cameraId, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Download each image from S3
        const { createWriteStream } = require('fs');
        const { pipeline } = require('stream/promises');

        for (let index = 0; index < weeklyImageKeys.length; index++) {
            const key = weeklyImageKeys[index];
            const sequentialName = path.join(tempDir, `${String(index + 1).padStart(3, '0')}.jpg`);

            const getObjectCommand = new GetObjectCommand({
                Bucket: CAMERA_BUCKET_NAME,
                Key: key
            });

            const response = await s3Client.send(getObjectCommand);
            const writeStream = createWriteStream(sequentialName);
            await pipeline(response.Body, writeStream);
        }

        const tempInputPattern = path.join(tempDir, '%03d.jpg'); // Sequential input pattern for FFmpeg

        // Ensure output directory exists
        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        ffmpeg()
            .input(tempInputPattern)
            .inputOptions(['-framerate 2']) // Set frame rate (2 frames per second)
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
                logger.error('Error generating video:', err);

                // Clean up the temporary directory on error
                if (fs.existsSync(tempDir)) {
                    fs.rmSync(tempDir, { recursive: true, force: true });
                }

                res.status(500).json({ error: 'Failed to generate video' });
            })
            .save(outputPath);
    } catch (error) {
        logger.error('Error in generateWeeklyVideo (S3):', error);
        res.status(404).json({ error: error.message });
    }
}

async function getEmaarPics(req, res) {
    try {
        const { developerId, projectId, cameraId } = req.params;
        const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;

        // List all objects with this prefix
        const objectKeys = await listS3Objects(s3Prefix);

        // Filter only .jpg files
        const jpgKeys = objectKeys.filter(key => key.endsWith('.jpg'));

        // Extract filenames
        const files = jpgKeys.map(key => extractFilename(key));

        // Filter files within the time range (08:00 - 17:59)
        const filteredFiles = files.filter(file => {
            const match = file.match(/^(\d{8})(\d{2})(\d{2})(\d{2})$/);
            if (!match) return false;

            const hour = parseInt(match[2], 10);
            return hour >= 8 && hour < 18; // Between 08:00 and 17:59
        });

        // Sort files in descending order (latest first)
        filteredFiles.sort((a, b) => a.localeCompare(b));

        // Return the filtered images
        filteredFiles.length > 0 ? res.json(filteredFiles) : res.status(404).json({ error: "error" });
    } catch (error) {
        logger.error('Error in getEmaarPics (S3):', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get presigned URL for a camera image
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
async function getImagePresignedUrl(req, res) {
    try {
        const { developerId, projectId, cameraId, imageTimestamp } = req.params;

        // Validate image timestamp format (YYYYMMDDHHMMSS)
        const timestampRegex = /^\d{14}$/;
        if (!timestampRegex.test(imageTimestamp)) {
            return res.status(400).json({ 
                error: 'Invalid image timestamp format. Use YYYYMMDDHHMMSS format (e.g., 20240114143000)' 
            });
        }

        // Construct the S3 key
        const s3Key = `upload/${developerId}/${projectId}/${cameraId}/large/${imageTimestamp}.jpg`;

        // Generate presigned URL
        const presignedUrl = await getPresignedUrl(s3Key);

        res.json({
            url: presignedUrl,
            key: s3Key,
            expiresIn: PRESIGNED_URL_EXPIRY
        });
    } catch (error) {
        logger.error('Error in getImagePresignedUrl (S3):', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get images for slideshow based on time range
 * @param {string} s3Prefix - S3 prefix path
 * @param {string} rangeType - '30days', 'quarter', '6months', '1year'
 * @returns {Promise<string[]>} Array of image filenames (without extension)
 */
async function getSlideshowImages(s3Prefix, rangeType) {
    const objectKeys = await listS3Objects(s3Prefix);
    const jpgKeys = objectKeys.filter(key => key.endsWith('.jpg'));

    if (jpgKeys.length === 0) {
        throw new Error('No pictures found in camera directory');
    }

    // Extract filenames and sort
    const files = jpgKeys.map(key => extractFilename(key));
    const sortedFiles = files.sort();

    // Get the actual date range from available images
    const firstFile = sortedFiles[0];
    const lastFile = sortedFiles[sortedFiles.length - 1];
    
    // Extract dates from first and last files (YYYYMMDD format)
    const firstDateStr = firstFile.slice(0, 8);
    const lastDateStr = lastFile.slice(0, 8);
    
    // Parse dates
    const firstDate = new Date(
        parseInt(firstDateStr.slice(0, 4)),
        parseInt(firstDateStr.slice(4, 6)) - 1,
        parseInt(firstDateStr.slice(6, 8))
    );
    
    const lastDate = new Date(
        parseInt(lastDateStr.slice(0, 4)),
        parseInt(lastDateStr.slice(4, 6)) - 1,
        parseInt(lastDateStr.slice(6, 8))
    );

    // Use the last available date as "now" for calculation
    const now = new Date(lastDate);
    // Set time to end of day to include the last day
    now.setHours(23, 59, 59, 999);
    let startDate;
    let intervalDays;

    // Calculate start date and interval based on range type
    switch (rangeType) {
        case '30days':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30);
            intervalDays = 1; // Daily
            break;
        case 'quarter':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 3);
            intervalDays = 3; // Every 3 days
            break;
        case '6months':
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 6);
            intervalDays = 7; // Weekly
            break;
        case '1year':
            startDate = new Date(now);
            startDate.setFullYear(startDate.getFullYear() - 1);
            intervalDays = 7; // Weekly
            break;
        default:
            throw new Error('Invalid range type');
    }

    // Ensure startDate doesn't go before the first available image
    if (startDate < firstDate) {
        startDate = new Date(firstDate);
    }

    const selectedImages = [];
    let currentDate = new Date(startDate);
    // Reset time to start of day
    currentDate.setHours(0, 0, 0, 0);

    logger.info(`Slideshow range: ${rangeType}, Start: ${startDate.toISOString()}, End: ${now.toISOString()}, First image: ${firstDateStr}, Last image: ${lastDateStr}`);

    while (currentDate <= now) {
        const dateStr = currentDate.getFullYear().toString() +
                       String(currentDate.getMonth() + 1).padStart(2, '0') +
                       String(currentDate.getDate()).padStart(2, '0');

        // Find all images for this date
        const dayImages = sortedFiles.filter(file => {
            const fileDateStr = file.slice(0, 8);
            return fileDateStr === dateStr;
        });

        if (dayImages.length > 0) {
            // Find the image closest to 12 PM (12:00:00)
            // Target time: 120000
            let closestImage = null;
            let minTimeDiff = Infinity;
            const targetTime = 120000; // 12:00:00 in HHMMSS format

            dayImages.forEach(file => {
                const fileTimeStr = file.slice(8, 14);
                const fileTime = parseInt(fileTimeStr);
                
                // Calculate time difference (absolute value)
                const timeDiff = Math.abs(fileTime - targetTime);
                
                if (timeDiff < minTimeDiff) {
                    minTimeDiff = timeDiff;
                    closestImage = file;
                }
            });

            // Only include if the closest image is within 2 hours of 12 PM (10:00 - 14:00)
            if (closestImage) {
                const closestTime = parseInt(closestImage.slice(8, 14));
                const hour = Math.floor(closestTime / 10000);
                
                // Accept images between 10:00 and 14:00 (10 AM to 2 PM)
                if (hour >= 10 && hour <= 14) {
                    selectedImages.push(closestImage);
                }
            }
        }

        // Move to next interval
        currentDate.setDate(currentDate.getDate() + intervalDays);
    }

    return selectedImages.sort();
}

/**
 * Get slideshow images for last 30 days
 */
async function getSlideshow30Days(req, res) {
    try {
        const { developerId, projectId, cameraId } = req.params;
        const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;

        const images = await getSlideshowImages(s3Prefix, '30days');

        res.json({
            images: images,
            count: images.length,
            rangeType: '30days',
            description: 'Last 30 days - Daily images at 12 PM'
        });
    } catch (error) {
        logger.error('Error in getSlideshow30Days (S3):', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get slideshow images for last quarter (3 months)
 */
async function getSlideshowQuarter(req, res) {
    try {
        const { developerId, projectId, cameraId } = req.params;
        const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;

        const images = await getSlideshowImages(s3Prefix, 'quarter');

        res.json({
            images: images,
            count: images.length,
            rangeType: 'quarter',
            description: 'Last quarter (3 months) - Every 3 days at 12 PM'
        });
    } catch (error) {
        logger.error('Error in getSlideshowQuarter (S3):', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get slideshow images for last 6 months
 */
async function getSlideshow6Months(req, res) {
    try {
        const { developerId, projectId, cameraId } = req.params;
        const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;

        const images = await getSlideshowImages(s3Prefix, '6months');

        res.json({
            images: images,
            count: images.length,
            rangeType: '6months',
            description: 'Last 6 months - Weekly images at 12 PM'
        });
    } catch (error) {
        logger.error('Error in getSlideshow6Months (S3):', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Get slideshow images for last 1 year
 */
async function getSlideshow1Year(req, res) {
    try {
        const { developerId, projectId, cameraId } = req.params;
        const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;

        const images = await getSlideshowImages(s3Prefix, '1year');

        res.json({
            images: images,
            count: images.length,
            rangeType: '1year',
            description: 'Last 1 year - Weekly images at 12 PM'
        });
    } catch (error) {
        logger.error('Error in getSlideshow1Year (S3):', error);
        res.status(500).json({ error: error.message });
    }
}

/**
 * Proxy image from S3 with CORS headers
 * This endpoint fetches the image from S3 and serves it with proper CORS headers
 * @param {Request} req - Express request object
 * @param {Response} res - Express response object
 */
async function proxyImage(req, res) {
    try {
        const { developerId, projectId, cameraId, imageTimestamp } = req.params;
        
        logger.info(`Proxy image request: ${developerId}/${projectId}/${cameraId}/${imageTimestamp}`);

        // Validate image timestamp format (YYYYMMDDHHMMSS)
        const timestampRegex = /^\d{14}$/;
        if (!timestampRegex.test(imageTimestamp)) {
            logger.warn(`Invalid timestamp format: ${imageTimestamp}`);
            return res.status(400).json({ 
                error: 'Invalid image timestamp format. Use YYYYMMDDHHMMSS format (e.g., 20240114143000)' 
            });
        }

        // Construct the S3 key
        const s3Key = `upload/${developerId}/${projectId}/${cameraId}/large/${imageTimestamp}.jpg`;

        // Generate presigned URL
        const presignedUrl = await getPresignedUrl(s3Key);

        // Parse the URL to determine protocol
        const url = new URL(presignedUrl);
        const client = url.protocol === 'https:' ? https : http;

        // Fetch the image from S3
        client.get(presignedUrl, (s3Response) => {
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Type');
            
            // CRITICAL: Set COEP to allow cross-origin resources
            res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
            res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
            
            res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

            // Set content type
            const contentType = s3Response.headers['content-type'] || 'image/jpeg';
            res.setHeader('Content-Type', contentType);

            // Handle errors from S3
            if (s3Response.statusCode !== 200) {
                logger.error(`S3 returned status ${s3Response.statusCode} for image ${imageTimestamp}`);
                return res.status(s3Response.statusCode).json({ error: 'Failed to fetch image from S3' });
            }

            // Pipe the image data to the response
            s3Response.pipe(res);
        }).on('error', (error) => {
            logger.error('Error proxying image from S3:', error);
            res.status(500).json({ error: 'Failed to proxy image', message: error.message });
        });
    } catch (error) {
        logger.error('Error in proxyImage:', error);
        res.status(500).json({ error: 'Failed to proxy image', message: error.message });
    }
}

module.exports = {
    getEmaarPics,
    getCameraPreview,
    generateWeeklyVideo,
    getCameraPictures,
    getImagePresignedUrl,
    getSlideshow30Days,
    getSlideshowQuarter,
    getSlideshow6Months,
    getSlideshow1Year,
    proxyImage
};

