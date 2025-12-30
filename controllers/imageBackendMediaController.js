const path = require('path');
const fs = require('fs');
const multer = require('multer');
const logger = require('../logger');

// Configure multer for file storage on image backend
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const { developerTag, projectTag, service, date } = req.body;
        
        // Create directory structure: MEDIA_PATH/upload/developerTag/projectTag/service/date/
        const uploadPath = path.join(
            process.env.MEDIA_PATH || './media',
            'upload',
            developerTag || 'unknown',
            projectTag || 'unknown',
            service || 'unknown',
            date || 'unknown'
        );
        
        // Ensure directory exists
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        // Keep original filename or use provided filename
        const fileName = file.originalname || `file-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname || '')}`;
        cb(null, fileName);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 500 * 1024 * 1024 // 500MB limit
    }
});

// Controller for handling file uploads on image backend
function handleImageBackendUpload(req, res) {
    try {
        const { developerTag, projectTag, service, date, mediaId } = req.body;
        
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ message: 'No files uploaded.' });
        }
        
        // Return file paths relative to the upload directory
        const files = req.files.map(file => {
            // Return relative path: developerTag/projectTag/service/date/filename
            return path.join(
                developerTag || 'unknown',
                projectTag || 'unknown',
                service || 'unknown',
                date || 'unknown',
                file.filename
            ).replace(/\\/g, '/'); // Use forward slashes for URLs
        });
        
        logger.info(`Files uploaded to image backend: ${files.length} files`);
        logger.info(`Files: ${files.join(', ')}`);
        
        res.status(200).json({
            message: 'Files uploaded successfully',
            files: files,
            count: files.length
        });
    } catch (error) {
        logger.error('Error in image backend upload:', error.message || String(error));
        res.status(500).json({ 
            message: 'Failed to upload files.', 
            error: error.message || 'Unknown error'
        });
    }
}

module.exports = {
    handleImageBackendUpload,
    upload
};

