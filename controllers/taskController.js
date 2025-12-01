const taskData = require('../models/taskData');
const operationusersData = require('../models/operationusersData');
const logger = require('../logger');
const path = require('path');
const fs = require('fs');
const DataModel = require('../models/DataModel');
const s3Service = require('../utils/s3Service');

const generateAttachmentId = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const getUploadedBy = (user) => {
    if (!user) {
        return 'system';
    }
    return user._id || user.id || user.userId || user.email || user.name || 'system';
};

const moveAttachments = async (taskId, files = [], user, context = 'initial') => {
    if (!files || files.length === 0) {
        return [];
    }

    const uploadedBy = getUploadedBy(user);
    const attachments = [];

    for (const file of files) {
        try {
            if (!fs.existsSync(file.path)) {
                logger.warn(`File not found at temp path: ${file.path}`);
                continue;
            }

            const newFileName = `${taskId}_${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
            const s3Key = s3Service.getTaskAttachmentKey(taskId, newFileName);

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

            attachments.push({
                _id: generateAttachmentId(),
                name: newFileName,
                originalName: file.originalname,
                size: file.size,
                type: file.mimetype,
                url: uploadResult.url,
                s3Key: s3Key, // Store S3 key for deletion later
                uploadedAt: new Date().toISOString(),
                uploadedBy,
                context, // 'initial' or 'note'
            });
        } catch (error) {
            logger.error('Failed to upload attachment to S3', error);
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

    return attachments;
};

// Get user ID from request
const getUserId = (req) => {
    if (!req.user) {
        return null;
    }
    
    // Try to get user ID from JWT token by looking up email
    if (req.user.email) {
        const users = operationusersData.getAllItems();
        const user = users.find(u => u.email === req.user.email);
        if (user) {
            return user._id;
        }
    }
    
    return req.user._id || req.user.id || req.user.userId || null;
};

// Get all tasks
function getAllTasks(req, res) {
    try {
        const { status, assignee, assigned, approver, type } = req.query;
        let tasks = taskData.getAllItems();

        // Apply filters
        if (status) {
            tasks = tasks.filter(task => task.status === status);
        }
        if (assignee) {
            tasks = tasks.filter(task => task.assignee === assignee);
        }
        if (assigned) {
            tasks = tasks.filter(task => task.assigned === assigned);
        }
        if (approver) {
            tasks = tasks.filter(task => task.approver === approver);
        }
        if (type) {
            tasks = tasks.filter(task => task.type === type);
        }

        res.json(tasks);
    } catch (error) {
        logger.error('Error getting tasks', error);
        res.status(500).json({ message: 'Failed to get tasks' });
    }
}

// Get task by ID
function getTaskById(req, res) {
    try {
        const task = taskData.getItemById(req.params.id);
        if (task) {
            res.json(task);
        } else {
            res.status(404).json({ message: 'Task not found' });
        }
    } catch (error) {
        logger.error('Error getting task', error);
        res.status(500).json({ message: 'Failed to get task' });
    }
}

// Create new task
async function createTask(req, res) {
    try {
        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const { title, description, type, assignee, approver, notes } = req.body;

        // Validation
        if (!title || !title.trim()) {
            return res.status(400).json({ message: 'Task title is required' });
        }
        if (!type || !type.trim()) {
            return res.status(400).json({ message: 'Task type is required' });
        }
        if (!assignee || !assignee.trim()) {
            return res.status(400).json({ message: 'Assignee is required' });
        }

        // Get user info
        const users = operationusersData.getAllItems();
        const assignedUser = users.find(u => u._id === userId);
        const assigneeUser = users.find(u => u._id === assignee);
        const approverUser = approver ? users.find(u => u._id === approver) : null;

        const taskPayload = {
            title: title.trim(),
            description: description || '',
            type: type.trim(),
            assignee: assignee.trim(),
            assigneeName: assigneeUser?.name || '',
            assigned: userId,
            assignedName: assignedUser?.name || '',
            approver: approver && approver.trim() ? approver.trim() : null,
            approverName: approverUser?.name || null,
            status: 'open',
            attachments: [],
            notes: [],
            createdDate: new Date().toISOString(),
            updatedDate: new Date().toISOString(),
        };

        // Create task first to get ID
        const task = taskData.addItem(taskPayload);
        const taskId = task._id;

        // Handle initial attachments
        const attachmentFiles = req.files || [];
        if (attachmentFiles.length > 0) {
            const attachments = await moveAttachments(taskId, attachmentFiles, req.user, 'initial');
            if (attachments.length > 0) {
                task.attachments = attachments;
                taskData.updateItem(taskId, { attachments });
            }
        }

        // Add initial note if provided
        if (notes && notes.trim()) {
            const initialNote = {
                _id: generateAttachmentId(),
                content: notes.trim(),
                user: userId,
                userName: assignedUser?.name || 'Unknown',
                attachments: [],
                createdAt: new Date().toISOString(),
            };
            task.notes = [initialNote];
            taskData.updateItem(taskId, { notes: [initialNote] });
        }

        return res.status(201).json(task);
    } catch (error) {
        logger.error('Error creating task', error);
        return res.status(500).json({ message: 'Failed to create task' });
    }
}

// Update task
async function updateTask(req, res) {
    try {
        const taskId = req.params.id;
        const task = taskData.getItemById(taskId);
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        const { title, description, type, assignee, approver, status } = req.body;

        const updateData = {
            updatedDate: new Date().toISOString(),
        };

        if (title !== undefined) updateData.title = title.trim();
        if (description !== undefined) updateData.description = description || '';
        if (type !== undefined) updateData.type = type.trim();
        if (status !== undefined) updateData.status = status;

        // Update assignee if provided
        if (assignee !== undefined) {
            const users = operationusersData.getAllItems();
            const assigneeUser = users.find(u => u._id === assignee);
            updateData.assignee = assignee.trim();
            updateData.assigneeName = assigneeUser?.name || '';
        }

        // Update approver if provided
        if (approver !== undefined) {
            if (approver && approver.trim()) {
                const users = operationusersData.getAllItems();
                const approverUser = users.find(u => u._id === approver);
                updateData.approver = approver.trim();
                updateData.approverName = approverUser?.name || '';
            } else {
                updateData.approver = null;
                updateData.approverName = null;
            }
        }

        // Handle attachments (for initial task attachments)
        const attachmentFiles = req.files || [];
        if (attachmentFiles.length > 0) {
            const attachments = await moveAttachments(taskId, attachmentFiles, req.user, 'initial');
            if (attachments.length > 0) {
                const existingAttachments = task.attachments || [];
                updateData.attachments = [...existingAttachments, ...attachments];
            }
        }

        const updatedTask = taskData.updateItem(taskId, updateData);
        return res.json(updatedTask);
    } catch (error) {
        logger.error('Error updating task', error);
        return res.status(500).json({ message: 'Failed to update task' });
    }
}

// Add note to task
async function addNote(req, res) {
    try {
        const taskId = req.params.id;
        const task = taskData.getItemById(taskId);
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task.status === 'closed') {
            return res.status(400).json({ message: 'Cannot add notes to closed tasks' });
        }

        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        const { content } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ message: 'Note content is required' });
        }

        // Verify user has permission (assignee, assigned, or approver)
        const users = operationusersData.getAllItems();
        const user = users.find(u => u._id === userId);
        
        const isAssignee = task.assignee === userId;
        const isAssigned = task.assigned === userId;
        const isApprover = task.approver === userId;

        if (!isAssignee && !isAssigned && !isApprover) {
            return res.status(403).json({ message: 'You do not have permission to add notes to this task' });
        }

        // Handle note attachments
        const attachmentFiles = req.files || [];
        const noteAttachments = await moveAttachments(taskId, attachmentFiles, req.user, 'note');

        const newNote = {
            _id: generateAttachmentId(),
            content: content.trim(),
            user: userId,
            userName: user?.name || 'Unknown',
            attachments: noteAttachments,
            createdAt: new Date().toISOString(),
        };

        const existingNotes = task.notes || [];
        const updatedNotes = [...existingNotes, newNote];

        const updatedTask = taskData.updateItem(taskId, {
            notes: updatedNotes,
            updatedDate: new Date().toISOString(),
        });

        return res.json(updatedTask);
    } catch (error) {
        logger.error('Error adding note', error);
        return res.status(500).json({ message: 'Failed to add note' });
    }
}

// Close task
function closeTask(req, res) {
    try {
        const taskId = req.params.id;
        const task = taskData.getItemById(taskId);
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (task.status === 'closed') {
            return res.status(400).json({ message: 'Task is already closed' });
        }

        const userId = getUserId(req);
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }

        // Verify user has permission (assignee or approver)
        const isAssignee = task.assignee === userId;
        const isApprover = task.approver === userId;

        if (!isAssignee && !isApprover) {
            return res.status(403).json({ message: 'Only assignee or approver can close this task' });
        }

        const updatedTask = taskData.updateItem(taskId, {
            status: 'closed',
            closedBy: userId,
            closedAt: new Date().toISOString(),
            updatedDate: new Date().toISOString(),
        });

        return res.json(updatedTask);
    } catch (error) {
        logger.error('Error closing task', error);
        return res.status(500).json({ message: 'Failed to close task' });
    }
}

// Delete task
async function deleteTask(req, res) {
    try {
        const taskId = req.params.id;
        const task = taskData.getItemById(taskId);
        
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Delete all attachments from S3
        const allAttachments = [
            ...(task.attachments || []),
            ...(task.notes || []).flatMap(note => note.attachments || [])
        ];

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

        const isDeleted = taskData.deleteItem(taskId);
        
        if (isDeleted) {
            res.status(204).send();
        } else {
            res.status(404).json({ message: 'Task not found' });
        }
    } catch (error) {
        logger.error('Error deleting task', error);
        res.status(500).json({ message: 'Failed to delete task' });
    }
}

module.exports = {
    getAllTasks,
    getTaskById,
    createTask,
    updateTask,
    addNote,
    closeTask,
    deleteTask,
};

