const s3Service = require('../utils/s3Service');
const logger = require('../logger');

/**
 * Get presigned URL for an attachment
 * POST /api/attachments/presigned-url
 * Body: { url: "s3-url-or-key" }
 */
async function getPresignedUrl(req, res) {
    try {
        const { url, key } = req.body;

        if (!url && !key) {
            return res.status(400).json({ 
                success: false, 
                message: 'Either "url" or "key" is required' 
            });
        }

        // Use key if provided, otherwise extract from URL
        const s3Key = key || s3Service.extractKeyFromUrl(url);
        
        if (!s3Key) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid URL or key provided' 
            });
        }

        // Generate presigned URL (valid for 7 days)
        const presignedUrl = await s3Service.getPresignedUrl(s3Key, 7 * 24 * 60 * 60);

        res.json({
            success: true,
            url: presignedUrl,
            key: s3Key
        });
    } catch (error) {
        logger.error('Error generating presigned URL:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to generate presigned URL'
        });
    }
}

module.exports = {
    getPresignedUrl
};

