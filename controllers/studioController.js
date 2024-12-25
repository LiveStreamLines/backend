const path = require('path');
const fs = require('fs');

// Controller for saving canvas image
function saveCanvasImage(req, res) {
    const { imageData } = req.body;

    if (!imageData) {
        return res.status(400).json({ message: 'No image data provided' });
    }

    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    const fileName = `canvas_${Date.now()}.png`; // Unique file name
    const filePath = path.join(process.env.MEDIA_PATH, 'canvas_images', fileName);

    fs.writeFile(filePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error('Error saving canvas image:', err);
            return res.status(500).json({ message: 'Error saving image' });
        }
        // Respond with the file URL
        res.json({ url: `/media/canvas_images/${fileName}` });
    });
}

module.exports = {
    saveCanvasImage,
};
