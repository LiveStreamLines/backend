const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('../logger');

// S3 Configuration for Camera Pictures (iDrive E2)
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

// S3 Bucket name for camera pictures
const CAMERA_BUCKET_NAME = process.env.S3_CAMERA_BUCKET_NAME || 'camera-picture';

// Presigned URL expiration (7 days)
const PRESIGNED_URL_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * List all objects in S3 with the given prefix
 * @param {string} prefix - S3 key prefix (e.g., "rta/cscec/camera1/large/")
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
 * @param {string} key - Full S3 key (e.g., "rta/cscec/camera1/large/20240101120000.jpg")
 * @returns {string} Filename (e.g., "20240101120000")
 */
function extractFilename(key) {
    const parts = key.split('/');
    const filename = parts[parts.length - 1].replace('.jpg', '');
    return filename;
}

async function getImagesByDateRange(req, res) {
  try {
    const { projectId, cameraId } = req.params;
    const { day1, time1, day2, time2 } = req.body;
    // For testing: projectId should be 'rta', developerId is 'cscec', cameraId is 'camera1'
    // Path structure: rta/cscec/camera1/large/
    const developerId = 'cscec'; // Using cscec for testing as mentioned by user

    // Validate required parameters (day1 and time1 are always required)
    if (!day1 || !time1) {
      return res.status(400).json({ 
        error: 'Missing required parameters: day1, time1' 
      });
    }

    // Validate date format (YYYYMMDD) for day1
    const dateRegex = /^\d{8}$/;
    if (!dateRegex.test(day1)) {
      return res.status(400).json({ 
        error: 'Invalid date format. Use YYYYMMDD format for day1' 
      });
    }

    // Validate time format (HHMMSS) for time1
    const timeRegex = /^\d{6}$/;
    if (!timeRegex.test(time1)) {
      return res.status(400).json({ 
        error: 'Invalid time format. Use HHMMSS format for time1' 
      });
    }

    // If day2 and time2 are not provided, calculate 1 hour later from day1 and time1
    let finalDay2, finalTime2;
    
    if (!day2 || !time2) {
      // Parse the start date and time
      const year = parseInt(day1.slice(0, 4));
      const month = parseInt(day1.slice(4, 6)) - 1; // Month is 0-based in Date constructor
      const day = parseInt(day1.slice(6, 8));
      const hour = parseInt(time1.slice(0, 2));
      const minute = parseInt(time1.slice(2, 4));
      const second = parseInt(time1.slice(4, 6));

      // Create a Date object and add 1 hour
      const startDate = new Date(year, month, day, hour, minute, second);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour (60 minutes * 60 seconds * 1000 milliseconds)

      // Format the end date and time
      finalDay2 = endDate.getFullYear().toString() + 
                  String(endDate.getMonth() + 1).padStart(2, '0') + 
                  String(endDate.getDate()).padStart(2, '0');
      finalTime2 = String(endDate.getHours()).padStart(2, '0') + 
                   String(endDate.getMinutes()).padStart(2, '0') + 
                   String(endDate.getSeconds()).padStart(2, '0');
    } else {
      // Validate day2 and time2 if provided
      if (!dateRegex.test(day2)) {
        return res.status(400).json({ 
          error: 'Invalid date format. Use YYYYMMDD format for day2' 
        });
      }
      if (!timeRegex.test(time2)) {
        return res.status(400).json({ 
          error: 'Invalid time format. Use HHMMSS format for time2' 
        });
      }
      finalDay2 = day2;
      finalTime2 = time2;
    }

    // S3 prefix path: upload/{developerId}/{projectId}/{cameraId}/large/
    // For testing: upload/cscec/rta/camera1/large/
    // Note: Based on user's folder structure, there's an 'upload' folder at the root of the bucket,
    // then developerId='cscec', projectId='rta', cameraId='camera1'
    const s3Prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;

    // List all objects with this prefix
    const objectKeys = await listS3Objects(s3Prefix);

    // Filter only .jpg files
    const jpgKeys = objectKeys.filter(key => key.endsWith('.jpg'));

    if (jpgKeys.length === 0) {
      return res.status(404).json({ error: 'No pictures found in camera directory' });
    }

    // Extract filenames (without .jpg extension)
    const files = jpgKeys.map(key => extractFilename(key));

    // Create start and end timestamps for comparison
    const startTimestamp = day1 + time1; // YYYYMMDDHHMMSS
    const endTimestamp = finalDay2 + finalTime2;   // YYYYMMDDHHMMSS

    // Filter files based on the date and time range
    const filteredFiles = files.filter(file => {
      // File is already in YYYYMMDDHHMMSS format (without .jpg)
      // Check if file timestamp is within the specified range
      return file >= startTimestamp && file <= endTimestamp;
    });

    // Sort files by timestamp (ascending order)
    filteredFiles.sort();

    // Generate presigned URLs for the filtered images
    // Note: The path in response will point to presigned URLs or a base path
    // For now, we'll return the image names and let the client construct URLs
    // or we can generate presigned URLs for each image (but that might be slow for many images)
    
    // Return the filtered images with metadata
    res.json({
      images: filteredFiles, // Array of image timestamps (without .jpg extension)
      count: filteredFiles.length,
      dateRange: {
        start: `${day1} ${time1.slice(0,2)}:${time1.slice(2,4)}:${time1.slice(4,6)}`,
        end: `${finalDay2} ${finalTime2.slice(0,2)}:${finalTime2.slice(2,4)}:${finalTime2.slice(4,6)}`
      },
      // Return base path for constructing image URLs
      // Note: Client will need to use presigned URLs or a proxy endpoint to access images
      path: `upload/${developerId}/${projectId}/${cameraId}/large`,
      bucket: CAMERA_BUCKET_NAME,
      autoCalculated: !day2 || !time2, // Indicate if the end time was auto-calculated
      source: 'idrive-e2' // Indicate this is from iDrive E2 bucket
    });
  } catch (error) {
    logger.error('Error in getImagesByDateRange (E2):', error);
    res.status(500).json({
      error: 'Failed to get images from E2 bucket',
      message: error.message
    });
  }
}

async function deleteImage(req, res) {
  try {
    const { developerId, projectId, cameraId, imageTimestamp } = req.params;

    // Validate required parameters
    if (!developerId || !projectId || !cameraId || !imageTimestamp) {
      return res.status(400).json({ 
        error: 'Missing required parameters: developerId, projectId, cameraId, imageTimestamp' 
      });
    }

    // Validate image timestamp format (YYYYMMDDHHMMSS)
    const timestampRegex = /^\d{14}$/;
    if (!timestampRegex.test(imageTimestamp)) {
      return res.status(400).json({ 
        error: 'Invalid image timestamp format. Use YYYYMMDDHHMMSS format (e.g., 20240114143000)' 
      });
    }

    // Construct the S3 key
    // Note: Path structure is upload/{developerId}/{projectId}/{cameraId}/large/
    const s3Key = `upload/${developerId}/${projectId}/${cameraId}/large/${imageTimestamp}.jpg`;

    // Note: Delete functionality would require DeleteObjectCommand
    // For now, we'll return an error indicating this needs to be implemented
    // or you can implement it using DeleteObjectCommand from @aws-sdk/client-s3
    
    res.status(501).json({
      error: 'Delete functionality not yet implemented for E2 bucket',
      imageTimestamp,
      s3Key: s3Key
    });
  } catch (error) {
    logger.error('Error in deleteImage (E2):', error);
    res.status(500).json({
      error: 'Failed to delete image',
      message: error.message
    });
  }
}

module.exports = {
  getImagesByDateRange,
  deleteImage
};

