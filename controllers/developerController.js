const developerData = require('../models/developerData');
const path = require('path');
const fs = require('fs');
const logger = require('../logger');

const MEDIA_ROOT = process.env.MEDIA_PATH || path.join(__dirname, '../media');
const LOGO_DIR = path.join(MEDIA_ROOT, 'logos/developer');
const DEVELOPER_ATTACHMENTS_DIR = path.join(MEDIA_ROOT, 'attachments/developers');
const TEMP_ATTACHMENT_DIR = path.join(DEVELOPER_ATTACHMENTS_DIR, 'temp');

const ensureDirectory = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

ensureDirectory(LOGO_DIR);
ensureDirectory(DEVELOPER_ATTACHMENTS_DIR);
ensureDirectory(TEMP_ATTACHMENT_DIR);

const generateAttachmentId = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

const getUploadedBy = (user) => {
    if (!user) {
        return 'system';
    }
    return user._id || user.id || user.userId || user.email || user.name || 'system';
};

const moveInternalAttachments = (developerId, files = [], user) => {
    if (!files || files.length === 0) {
        return [];
    }

    const attachmentsDir = path.join(DEVELOPER_ATTACHMENTS_DIR, developerId);
    ensureDirectory(attachmentsDir);

    const uploadedBy = getUploadedBy(user);
    const attachments = [];

    files.forEach((file) => {
        const newFileName = `${developerId}_${Date.now()}_${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;
        const targetPath = path.join(attachmentsDir, newFileName);
        try {
            fs.renameSync(file.path, targetPath);
            attachments.push({
                _id: generateAttachmentId(),
                name: newFileName,
                originalName: file.originalname,
                size: file.size,
                type: file.mimetype,
                url: `/media/attachments/developers/${developerId}/${newFileName}`,
                uploadedAt: new Date().toISOString(),
                uploadedBy,
            });
        } catch (error) {
            logger.error('Failed to move internal attachment', error);
            try {
                fs.unlinkSync(file.path);
            } catch (unlinkError) {
                logger.warn('Failed to clean up temp attachment', unlinkError);
            }
        }
    });

    return attachments;
};

const saveLogoFile = (developerId, file) => {
    if (!file) {
        return null;
    }
    ensureDirectory(LOGO_DIR);
    const logoFileName = `${developerId}${path.extname(file.originalname)}`;
    const targetPath = path.join(LOGO_DIR, logoFileName);
    try {
        fs.renameSync(file.path, targetPath);
        return `logos/developer/${logoFileName}`;
    } catch (error) {
        logger.error('Error saving developer logo', error);
        return null;
    }
};

// Controller for getting all developers
function getAllDevelopers(req, res) {
    const developers = developerData.getAllItems();
    res.json(developers);
}

// Controller for getting a single developer by ID
function getDeveloperById(req, res) {
    const developer = developerData.getItemById(req.params.id);
    if (developer) {
        res.json(developer);
    } else {
        res.status(404).json({ message: 'Developer not found' });
    }
}

function getDeveloperbyTag(req, res){
    const developer = developerData.getDeveloperByTag(req.params.tag);
    if (developer) {
        res.json(developer);
    } else {
        res.status(404).json({message : 'Developer not found' });
    }
}

// Controller for adding a new developer
function addDeveloper(req, res) {
    try {
        const payload = {
            ...req.body,
            internalDescription: req.body.internalDescription || '',
            internalAttachments: [],
        };

        const addedDeveloper = developerData.addItem(payload);
        let response = addedDeveloper;

        const logoFile = req.files?.logo?.[0];
        if (logoFile) {
            const logoPath = saveLogoFile(addedDeveloper._id, logoFile);
            if (logoPath) {
                response = developerData.updateItem(addedDeveloper._id, { logo: logoPath }) || response;
            }
        } else {
            response = developerData.updateItem(addedDeveloper._id, { logo: '' }) || response;
        }

        const attachmentFiles = req.files?.internalAttachments || [];
        if (attachmentFiles.length > 0) {
            const attachments = moveInternalAttachments(addedDeveloper._id, attachmentFiles, req.user);
            if (attachments.length > 0) {
                response = developerData.updateItem(addedDeveloper._id, { internalAttachments: attachments }) || response;
            }
        }

        return res.status(201).json(response);
    } catch (error) {
        logger.error('Error adding developer', error);
        return res.status(500).json({ message: 'Failed to add developer' });
    }
}

// Controller for updating a developer
function updateDeveloper(req, res) {
    try {
        const developerId = req.params.id;
        const updatedData = {
            ...req.body,
            internalDescription: req.body.internalDescription || '',
        };
        delete updatedData.internalAttachments;

        let updatedDeveloper = developerData.updateItem(developerId, updatedData);

        if (!updatedDeveloper) {
            return res.status(404).json({ message: 'Developer not found' });
        }

        const logoFile = req.files?.logo?.[0];
        if (logoFile) {
            const logoPath = saveLogoFile(developerId, logoFile);
            if (logoPath) {
                updatedDeveloper = developerData.updateItem(developerId, { logo: logoPath }) || updatedDeveloper;
            }
        }

        const attachmentFiles = req.files?.internalAttachments || [];
        if (attachmentFiles.length > 0) {
            const attachments = moveInternalAttachments(developerId, attachmentFiles, req.user);
            if (attachments.length > 0) {
                const merged = [...(updatedDeveloper.internalAttachments || []), ...attachments];
                updatedDeveloper = developerData.updateItem(developerId, { internalAttachments: merged }) || updatedDeveloper;
            }
        }

        return res.json(updatedDeveloper);
    } catch (error) {
        logger.error('Error updating developer', error);
        return res.status(500).json({ message: 'Failed to update developer' });
    }
}

// Controller for deleting a developer
function deleteDeveloper(req, res) {
    const isDeleted = developerData.deleteItem(req.params.id);
    if (isDeleted) {
        res.status(204).send();
    } else {
        res.status(404).json({ message: 'Developer not found' });
    }
}

module.exports = {
    getAllDevelopers,
    getDeveloperById,
    getDeveloperbyTag,
    addDeveloper,
    updateDeveloper,
    deleteDeveloper
};
