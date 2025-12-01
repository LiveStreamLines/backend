const maintenanceData = require('../models/maintenanceData');
const operationusersData = require('../models/operationusersData');
const logger = require('../logger');
const path = require('path');
const fs = require('fs');
const DataModel = require('../models/DataModel');
const s3Service = require('../utils/s3Service');

const maintenanceController = {
    // Get all maintenance requests
    getAllMaintenance: (req, res) => {
        try {
            const maintenance = maintenanceData.getAllItems();
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get maintenance request by ID
    getMaintenanceById: (req, res) => {
        try {
            const maintenance = maintenanceData.getItemById(req.params.id);
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Create new maintenance request
    createMaintenance: async (req, res) => {
        try {
            // Log request details for debugging
            logger.info('=== Create Maintenance Request ===');
            logger.info('Request has files:', !!req.files);
            logger.info('Files count:', req.files ? req.files.length : 0);
            if (req.files && req.files.length > 0) {
                logger.info('Files details:', req.files.map(f => ({
                    originalname: f.originalname,
                    path: f.path,
                    size: f.size,
                    mimetype: f.mimetype
                })));
            }
            
            // Ensure creator information is registered with user ID (not just name)
            const taskData = { ...req.body };
            
            // Parse array fields from JSON strings (FormData sends arrays as JSON strings)
            if (taskData.assistants && typeof taskData.assistants === 'string') {
                try {
                    taskData.assistants = JSON.parse(taskData.assistants);
                } catch (e) {
                    // If parsing fails, try to handle as comma-separated string
                    taskData.assistants = taskData.assistants.split(',').map(item => item.trim()).filter(item => item.length > 0);
                }
            }
            // Ensure assistants is an array
            if (taskData.assistants !== undefined && !Array.isArray(taskData.assistants)) {
                taskData.assistants = [];
            }
            
            // Priority 1: Use addedUserId from request body if provided
            // Priority 2: Look up user by email from JWT token to get _id
            // Priority 3: Try direct fields from req.user
            if (!taskData.addedUserId && req.user) {
                // JWT token contains email, so look up user by email to get _id
                if (req.user.email) {
                    const users = operationusersData.getAllItems();
                    const user = users.find(u => u.email === req.user.email);
                    if (user) {
                        // Ensure we save the user ID (_id), not the name
                        taskData.addedUserId = user._id;
                        taskData.addedUserName = user.name;
                        logger.info(`Task creator registered: ID=${user._id}, Name=${user.name}`);
                    }
                }
                
                // Fallback: try direct fields from req.user
                if (!taskData.addedUserId) {
                    taskData.addedUserId = req.user._id || req.user.id || req.user.userId;
                    taskData.addedUserName = req.user.name || req.user.userName;
                }
            }
            
            // Validate that addedUserId is set (it should be the user's _id, not name)
            if (taskData.addedUserId) {
                // Ensure addedUserId is actually an ID (not a name)
                // If it looks like a name (contains spaces or is too short), try to find the user
                if (taskData.addedUserId.length < 10 || taskData.addedUserId.includes(' ')) {
                    logger.warn('addedUserId appears to be a name, looking up user', { addedUserId: taskData.addedUserId });
                    const users = operationusersData.getAllItems();
                    const user = users.find(u => u.name === taskData.addedUserId || u.email === taskData.addedUserId);
                    if (user) {
                        taskData.addedUserId = user._id;
                        taskData.addedUserName = user.name;
                    }
                }
                logger.info(`Task will be saved with creator: addedUserId=${taskData.addedUserId}, addedUserName=${taskData.addedUserName}`);
            } else {
                logger.warn('Task created without creator ID (addedUserId)', { body: req.body, user: req.user });
            }
            
            // Initialize attachments array in taskData
            taskData.attachments = [];
            
            // Create the maintenance task first to get its ID
            const maintenance = maintenanceData.addItem(taskData);
            const taskId = maintenance._id;
            
            logger.info(`Created maintenance task ${taskId}, processing attachments...`);
            
            // Handle file attachments if any
            if (req.files && req.files.length > 0) {
                logger.info(`Processing ${req.files.length} attachment(s) for maintenance task ${taskId}`);
                try {
                    const dataModel = new DataModel('temp');
                    const attachments = [];
                    
                    // Upload files to S3
                    for (const file of req.files) {
                        try {
                            logger.info(`Processing file: ${file.originalname}, path: ${file.path}`);
                            
                            if (!fs.existsSync(file.path)) {
                                logger.warn(`File not found at temp path: ${file.path}`);
                                continue;
                            }

                            const newFileName = `${taskId}_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
                            const s3Key = s3Service.getMaintenanceAttachmentKey(taskId, newFileName);
                            
                            logger.info(`Uploading to S3 with key: ${s3Key}`);

                            // Upload to S3
                            const uploadResult = await s3Service.uploadFileToS3(
                                file.path,
                                s3Key,
                                file.mimetype,
                                file.originalname
                            );
                            
                            logger.info(`Successfully uploaded to S3: ${uploadResult.url}`);

                            // Clean up temp file
                            try {
                                fs.unlinkSync(file.path);
                            } catch (unlinkError) {
                                logger.warn('Failed to clean up temp attachment', unlinkError);
                            }

                            // Create attachment object
                            const attachment = {
                                _id: dataModel.generateCustomId(),
                                name: newFileName,
                                originalName: file.originalname,
                                size: file.size,
                                type: file.mimetype,
                                url: uploadResult.url,
                                s3Key: s3Key, // Store S3 key for deletion later
                                uploadedAt: new Date().toISOString(),
                                uploadedBy: taskData.addedUserId || req.user?.id || req.user?._id || 'system',
                                context: 'assignment' // Attachments uploaded during task creation
                            };
                            
                            attachments.push(attachment);
                            logger.info(`Added attachment to array: ${attachment._id}`);
                        } catch (uploadError) {
                            logger.error('Error uploading attachment to S3:', uploadError);
                            logger.error('Upload error details:', {
                                message: uploadError.message,
                                stack: uploadError.stack,
                                file: file.originalname
                            });
                            // Clean up temp file on error
                            try {
                                if (fs.existsSync(file.path)) {
                                    fs.unlinkSync(file.path);
                                }
                            } catch (unlinkError) {
                                logger.warn('Failed to clean up temp attachment on error', unlinkError);
                            }
                        }
                    }
                    
                    // Update maintenance task with attachments
                    if (attachments.length > 0) {
                        logger.info(`Updating maintenance task ${taskId} with ${attachments.length} attachment(s)`);
                        const updatedMaintenance = maintenanceData.updateItem(taskId, { attachments: attachments });
                        if (updatedMaintenance) {
                            maintenance = updatedMaintenance; // Update the maintenance object for response
                            logger.info(`Successfully updated maintenance task with attachments`);
                        } else {
                            logger.error(`Failed to update maintenance task ${taskId} with attachments`);
                        }
                    } else {
                        logger.warn(`No attachments were successfully uploaded for maintenance task ${taskId}`);
                    }
                } catch (fileError) {
                    logger.error('Error processing attachments:', fileError);
                    logger.error('File error details:', {
                        message: fileError.message,
                        stack: fileError.stack
                    });
                    // Don't fail the entire request if file processing fails
                    // The task is already created, just log the error
                }
            } else {
                logger.info(`No files attached to maintenance task ${taskId}`);
            }
            
            res.status(201).json(maintenance);
        } catch (error) {
            logger.error('Error creating maintenance task', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Update maintenance request
    updateMaintenance: async (req, res) => {
        try {
            const taskId = req.params.id;
            const existingTask = maintenanceData.getItemById(taskId);
            if (!existingTask) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }

            // Prepare update data from request body
            const updateData = { ...req.body };
            
            // Determine attachment context based on update type
            // If status is being set to 'completed' (or task is already completed), these are completion attachments
            // Otherwise, they're assignment/update attachments
            // Note: FormData sends all fields as strings, so we check string values
            const newStatus = updateData.status ? String(updateData.status).toLowerCase() : null;
            const isCompletion = newStatus === 'completed' || existingTask.status === 'completed';
            const attachmentContext = isCompletion ? 'completion' : 'assignment';
            
            // Handle file attachments if any
            if (req.files && req.files.length > 0) {
                try {
                    const dataModel = new DataModel('temp');
                    const newAttachments = [];
                    
                    // Upload files to S3
                    for (const file of req.files) {
                        try {
                            if (!fs.existsSync(file.path)) {
                                logger.warn(`File not found at temp path: ${file.path}`);
                                continue;
                            }

                            const newFileName = `${taskId}_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
                            const s3Key = s3Service.getMaintenanceAttachmentKey(taskId, newFileName);

                            // Upload to S3
                            const uploadResult = await s3Service.uploadFileToS3(
                                file.path,
                                s3Key,
                                file.mimetype,
                                file.originalname
                            );

                            // Clean up temp file
                            try {
                                fs.unlinkSync(file.path);
                            } catch (unlinkError) {
                                logger.warn('Failed to clean up temp attachment', unlinkError);
                            }

                            // Create attachment object
                            const attachment = {
                                _id: dataModel.generateCustomId(),
                                name: newFileName,
                                originalName: file.originalname,
                                size: file.size,
                                type: file.mimetype,
                                url: uploadResult.url,
                                s3Key: s3Key, // Store S3 key for deletion later
                                uploadedAt: new Date().toISOString(),
                                uploadedBy: req.user?.id || req.user?._id || 'system',
                                context: attachmentContext // 'assignment' or 'completion'
                            };
                            
                            newAttachments.push(attachment);
                        } catch (uploadError) {
                            logger.error('Error uploading attachment to S3:', uploadError);
                            // Clean up temp file on error
                            try {
                                if (fs.existsSync(file.path)) {
                                    fs.unlinkSync(file.path);
                                }
                            } catch (unlinkError) {
                                logger.warn('Failed to clean up temp attachment on error', unlinkError);
                            }
                        }
                    }
                    
                    // Merge new attachments with existing ones
                    const existingAttachments = existingTask.attachments || [];
                    updateData.attachments = [...existingAttachments, ...newAttachments];
                } catch (fileError) {
                    logger.error('Error processing attachments during update:', fileError);
                    // Continue with update even if file processing fails
                }
            }
            
            // Update the maintenance task
            const maintenance = maintenanceData.updateItem(taskId, updateData);
            if (!maintenance) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }
            
            res.json(maintenance);
        } catch (error) {
            logger.error('Error updating maintenance task', error);
            res.status(500).json({ message: error.message });
        }
    },

    // Delete maintenance request
    deleteMaintenance: async (req, res) => {
        try {
            const taskId = req.params.id;
            const task = maintenanceData.getItemById(taskId);
            
            if (!task) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }

            // Delete all attachments from S3
            const allAttachments = task.attachments || [];
            for (const attachment of allAttachments) {
                try {
                    const s3Key = attachment.s3Key || s3Service.extractKeyFromUrl(attachment.url);
                    if (s3Key) {
                        await s3Service.deleteFromS3(s3Key);
                    }
                } catch (error) {
                    logger.warn(`Failed to delete attachment from S3: ${attachment.url}`, error);
                }
            }

            const success = maintenanceData.deleteItem(taskId);
            if (!success) {
                return res.status(404).json({ message: 'Maintenance request not found' });
            }
            res.json({ message: 'Maintenance request deleted successfully' });
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get maintenance requests by camera ID
    getMaintenanceByCamera: (req, res) => {
        try {
            const maintenance = maintenanceData.getAllItems().filter(
                item => item.cameraId === req.params.cameraId
            );
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    },

    // Get maintenance requests by assigned user
    getMaintenanceByUser: (req, res) => {
        try {
            const maintenance = maintenanceData.getAllItems().filter(
                item => item.assignedUser === req.params.userId
            );
            res.json(maintenance);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    }
};

module.exports = maintenanceController;