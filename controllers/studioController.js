const path = require('path');
const fs = require('fs');

// Controller for saving canvas image
function saveCanvasImage(req, res) {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `${process.env.MEDIA_PATH}/canvas_images/${req.file.filename}`;
    res.json({ url: fileUrl }); // Respond with the file URL
}

module.exports = {
    saveCanvasImage,
};
