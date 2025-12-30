const path = require('path');
const fs = require('fs');
const mediaData = require('../models/mediaData');
const developerData = require('../models/developerData');
const projectData = require('../models/projectData');
const s3Service = require('../utils/s3Service');
const logger = require('../logger');

// Controller for handling media form submissions
async function handleMediaForm(req, res) {
    try {
        const { developer, project, service, date } = req.body;

        if (!developer || !project || !service || !date) {
            return res.status(400).json({ message: 'All fields are required.' });
        }

        // Get developer and project information to extract tags
        const developerInfo = developerData.getItemById(developer);
        const projectInfo = projectData.getItemById(project);

        if (!developerInfo) {
            return res.status(400).json({ message: 'Developer not found.' });
        }

        if (!projectInfo) {
            return res.status(400).json({ message: 'Project not found.' });
        }

        const developerTag = developerInfo.developerTag || developer;
        const projectTag = projectInfo.projectTag || project;
        const developerName = developerInfo.developerName || developer;
        const projectName = projectInfo.projectName || project;

        // Prepare media metadata
        const newMedia = {
            developerId: developer,
            projectId: project,
            developerTag: developerTag,
            projectTag: projectTag,
            developer: developerName,
            project: projectName,
            service: service,
            date: date,
            files: [],
            RequestTime: new Date().toISOString()
        };

        // Save metadata to data backend first
        const savedMedia = mediaData.addItem(newMedia);

        // If there are files, upload them to iDrive E2 (S3)
        if (req.files && req.files.length > 0) {
            logger.info(`Number of files to upload to S3: ${req.files.length}`);

            // Process each file and upload to S3
            const filePromises = req.files.map(async (file, index) => {
                try {
                    // Use file buffer from memory storage
                    const fileBuffer = file.buffer;
                    
                    // Generate unique filename
                    const timestamp = Date.now();
                    const randomSuffix = Math.round(Math.random() * 1E9);
                    const fileExtension = path.extname(file.originalname);
                    const baseName = path.basename(file.originalname, fileExtension);
                    const fileName = `${baseName}-${timestamp}-${randomSuffix}${fileExtension}`;
                    
                    // Generate S3 key
                    const s3Key = s3Service.getMediaKey(developerTag, projectTag, service, date, fileName);
                    
                    logger.info(`Uploading file to S3: ${s3Key}`);
                    logger.info(`File: ${file.originalname}, Size: ${fileBuffer.length} bytes`);

                    // Upload to S3
                    const uploadResult = await s3Service.uploadToS3(
                        fileBuffer,
                        s3Key,
                        file.mimetype || 'application/octet-stream',
                        file.originalname
                    );
                    
                    logger.info(`Successfully uploaded to S3: ${uploadResult.url}`);
                    logger.info(`S3 Key: ${uploadResult.key}`);

                    // Store file information
                    const fileInfo = {
                        s3Key: uploadResult.key,
                        url: uploadResult.url,
                        originalName: file.originalname,
                        fileName: fileName,
                        size: fileBuffer.length,
                        contentType: file.mimetype || 'application/octet-stream'
                    };
                    
                    newMedia.files.push(fileInfo);

                    return fileInfo;
                } catch (error) {
                    // Safely extract error details for logging
                    let errorMessage = 'Unknown error';
                    let errorCode = null;
                    
                    if (error && typeof error === 'object') {
                        errorMessage = error.message || error.toString() || 'Unknown error';
                        errorCode = error.code || null;
                    } else if (error) {
                        errorMessage = String(error);
                    }
                    
                    // Log error details
                    logger.error(`Error uploading file to S3 - Message: ${errorMessage}`);
                    if (errorCode) logger.error(`Error code: ${errorCode}`);
                    if (error.stack) logger.error(`Stack: ${error.stack.substring(0, 500)}`);
                    
                    throw new Error(`Failed to upload file to S3: ${errorMessage}`);
                }
            });

            // Wait for all files to be uploaded
            try {
                await Promise.all(filePromises);

                // Update metadata in data backend with file information
                mediaData.updateItem(savedMedia._id, { files: newMedia.files });
                
                res.status(201).json({ 
                    ...savedMedia, 
                    files: newMedia.files,
                    message: 'Media uploaded successfully to iDrive E2'
                });
            } catch (uploadError) {
                // If file upload fails, delete the metadata entry
                const uploadErrorMessage = uploadError && uploadError.message 
                    ? uploadError.message 
                    : (uploadError ? String(uploadError) : 'Unknown upload error');
                logger.error(`File upload failed, rolling back metadata: ${uploadErrorMessage}`);
                try {
                    mediaData.deleteItem(savedMedia._id);
                    logger.info('Metadata rollback successful');
                } catch (deleteError) {
                    const deleteErrorMessage = deleteError && deleteError.message 
                        ? deleteError.message 
                        : (deleteError ? String(deleteError) : 'Unknown delete error');
                    logger.error(`Failed to rollback metadata: ${deleteErrorMessage}`);
                }
                throw uploadError;
            }
        } else {
            // No files, just return saved metadata
            return res.status(201).json(savedMedia);
        }
    } catch (error) {
        // Safely extract error information without circular references
        let errorMessage = 'Unknown error occurred';
        let errorCode = null;
        let errorStack = null;
        
        if (error && typeof error === 'object') {
            errorMessage = error.message || error.toString() || 'Unknown error occurred';
            errorCode = error.code || null;
            errorStack = error.stack ? String(error.stack).substring(0, 1000) : null; // Limit stack length
        } else if (error) {
            errorMessage = String(error);
        }
        
        logger.error(`Error in handleMediaForm: ${errorMessage}`);
        if (errorCode) logger.error(`Error code: ${errorCode}`);
        if (errorStack) logger.error(`Error stack: ${errorStack}`);
        
        // Safely extract error details without circular references
        let errorDetails = null;
        if (error && error.response) {
            try {
                let responseData = null;
                if (typeof error.response.data === 'string') {
                    responseData = error.response.data;
                } else if (error.response.data) {
                    try {
                        responseData = JSON.parse(JSON.stringify(error.response.data));
                    } catch (e) {
                        responseData = String(error.response.data);
                    }
                }
                
                errorDetails = {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: responseData
                };
            } catch (e) {
                errorDetails = {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    message: 'Unable to parse response data'
                };
            }
        } else if (errorCode) {
            // Network errors might have code
            errorDetails = {
                code: errorCode,
                message: errorMessage
            };
        }
        
        res.status(500).json({ 
            message: 'Failed to process media upload.', 
            error: errorMessage,
            details: errorDetails
        });
    }
}

function getMedia(req, res){
  const media = mediaData.getAllItems();
  res.json(media);
}

module.exports = {
    handleMediaForm,
    getMedia
};
