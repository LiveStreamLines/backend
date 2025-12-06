const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const ffmpeg = require('fluent-ffmpeg');
const logger = require('../logger');
const fs = require('fs');
const path = require('path');

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
                ContinuationToken: continuationToken
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

        // List all objects with this prefix
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

module.exports = {
    getEmaarPics,
    getCameraPreview,
    generateWeeklyVideo,
    getCameraPictures
};

