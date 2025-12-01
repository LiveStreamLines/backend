const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const logger = require('../logger');

// S3 Configuration
const S3_CONFIG = {
    endpoint: 'https://s3.ap-southeast-1.idrivee2.com',
    region: 'ap-southeast-1',
    credentials: {
        accessKeyId: 'fMZXDwBL2hElR6rEzgCW',
        secretAccessKey: 'gXrfsUVEDttGQBv3GIfjZvokZ4qrAFsOUywiN4TD'
    },
    forcePathStyle: true, // Required for custom S3-compatible services
    signatureVersion: 'v4'
};

// Initialize S3 Client
const s3Client = new S3Client(S3_CONFIG);

// S3 Bucket name (you may want to make this configurable via environment variable)
const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'attachments';

// Track if bucket existence has been checked
let bucketChecked = false;

/**
 * Check if bucket exists, create if it doesn't
 * @returns {Promise<void>}
 */
async function ensureBucketExists() {
    // Only check once per runtime
    if (bucketChecked) {
        return;
    }

    try {
        // Check if bucket exists
        const headCommand = new HeadBucketCommand({
            Bucket: BUCKET_NAME
        });
        
        try {
            await s3Client.send(headCommand);
            logger.info(`S3 bucket "${BUCKET_NAME}" exists`);
            bucketChecked = true;
            return;
        } catch (headError) {
            if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404 || headError.name === 'NoSuchBucket') {
                // Bucket doesn't exist, try to create it
                logger.warn(`S3 bucket "${BUCKET_NAME}" does not exist, attempting to create...`);
                
                try {
                    const createCommand = new CreateBucketCommand({
                        Bucket: BUCKET_NAME
                        // Note: Some S3-compatible services don't need CreateBucketConfiguration
                    });
                    
                    await s3Client.send(createCommand);
                    logger.info(`Successfully created S3 bucket "${BUCKET_NAME}"`);
                    bucketChecked = true;
                } catch (createError) {
                    logger.error(`Failed to create bucket "${BUCKET_NAME}". Error: ${createError.message}`);
                    logger.error(`Please create the bucket "${BUCKET_NAME}" manually in your S3 console or set S3_BUCKET_NAME environment variable to an existing bucket.`);
                    // Don't throw - let the upload attempt show the actual error
                    bucketChecked = true;
                }
            } else {
                // Other error, log but continue
                logger.error(`Error checking bucket existence: ${headError.message}`);
                bucketChecked = true;
            }
        }
    } catch (error) {
        logger.error(`Error ensuring bucket exists: ${error.message}`);
        // Don't throw - let the upload attempt happen and show the real error
        bucketChecked = true; // Set to true to avoid retrying
    }
}

/**
 * Upload a file to S3
 * @param {Buffer|Stream} fileBuffer - The file buffer or stream
 * @param {string} key - The S3 object key (path)
 * @param {string} contentType - MIME type of the file
 * @param {string} originalName - Original filename
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadToS3(fileBuffer, key, contentType, originalName) {
    try {
        // Ensure bucket exists before uploading
        await ensureBucketExists();
        
        const command = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
            Body: fileBuffer,
            ContentType: contentType,
            Metadata: {
                'original-name': originalName || ''
            }
        });

        await s3Client.send(command);

        // For path-style URLs with custom endpoint
        // Use presigned URL for secure access, or construct path-style URL
        const url = `https://s3.ap-southeast-1.idrivee2.com/${BUCKET_NAME}/${key}`;
        
        logger.info(`File uploaded to S3: ${key}`);
        return {
            url: url,
            key: key
        };
    } catch (error) {
        logger.error('Error uploading file to S3:', error);
        
        // Provide helpful error message for bucket not found
        if (error.name === 'NoSuchBucket' || error.Code === 'NoSuchBucket') {
            const errorMsg = `S3 bucket "${BUCKET_NAME}" does not exist. Please create it manually in your S3 console (${S3_CONFIG.endpoint}) or set S3_BUCKET_NAME environment variable to an existing bucket name.`;
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }
        
        throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
}

/**
 * Upload a file from local path to S3
 * @param {string} filePath - Local file path
 * @param {string} key - The S3 object key (path)
 * @param {string} contentType - MIME type of the file
 * @param {string} originalName - Original filename
 * @returns {Promise<{url: string, key: string}>}
 */
async function uploadFileToS3(filePath, key, contentType, originalName) {
    try {
        const fileBuffer = fs.readFileSync(filePath);
        return await uploadToS3(fileBuffer, key, contentType, originalName);
    } catch (error) {
        logger.error('Error reading file for S3 upload:', error);
        throw new Error(`Failed to read file: ${error.message}`);
    }
}

/**
 * Generate a presigned URL for accessing a file (valid for 1 hour by default)
 * @param {string} key - The S3 object key
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600)
 * @returns {Promise<string>}
 */
async function getPresignedUrl(key, expiresIn = 3600) {
    try {
        const command = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        const url = await getSignedUrl(s3Client, command, { expiresIn });
        return url;
    } catch (error) {
        logger.error('Error generating presigned URL:', error);
        throw new Error(`Failed to generate presigned URL: ${error.message}`);
    }
}

/**
 * Delete a file from S3
 * @param {string} key - The S3 object key
 * @returns {Promise<void>}
 */
async function deleteFromS3(key) {
    try {
        const command = new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key
        });

        await s3Client.send(command);
        logger.info(`File deleted from S3: ${key}`);
    } catch (error) {
        logger.error('Error deleting file from S3:', error);
        throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
}

/**
 * Generate S3 key for task attachments
 * @param {string} taskId - Task ID
 * @param {string} filename - Filename
 * @returns {string}
 */
function getTaskAttachmentKey(taskId, filename) {
    return `attachments/tasks/${taskId}/${filename}`;
}

/**
 * Generate S3 key for maintenance (internal task) attachments
 * @param {string} taskId - Maintenance task ID
 * @param {string} filename - Filename
 * @returns {string}
 */
function getMaintenanceAttachmentKey(taskId, filename) {
    return `attachments/maintenance/${taskId}/${filename}`;
}

/**
 * Generate S3 key for contact attachments
 * @param {string} contactId - Contact ID
 * @param {string} filename - Filename
 * @returns {string}
 */
function getContactAttachmentKey(contactId, filename) {
    return `attachments/contacts/${contactId}/${filename}`;
}

/**
 * Extract key from S3 URL
 * @param {string} url - S3 URL
 * @returns {string|null}
 */
function extractKeyFromUrl(url) {
    try {
        // Handle both full URLs and paths
        if (url.startsWith('http://') || url.startsWith('https://')) {
            const urlObj = new URL(url);
            // Remove leading slash from pathname
            return urlObj.pathname.substring(1);
        }
        // If it's already a path, remove leading slash if present
        return url.startsWith('/') ? url.substring(1) : url;
    } catch (error) {
        logger.error('Error extracting key from URL:', error);
        return null;
    }
}

module.exports = {
    uploadToS3,
    uploadFileToS3,
    getPresignedUrl,
    deleteFromS3,
    getTaskAttachmentKey,
    getMaintenanceAttachmentKey,
    getContactAttachmentKey,
    extractKeyFromUrl,
    ensureBucketExists,
    BUCKET_NAME,
    s3Client
};

