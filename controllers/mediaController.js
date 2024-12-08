const path = require('path');
const fs = require('fs');
const mediaData = require('../data/mediaData'); // Assuming a similar structure like developerData.js

// Controller for handling media form submissions
function handleMediaForm(req, res) {
    const { developer, project, service, date } = req.body;

    if (!developer || !project || !service || !date) {
        return res.status(400).json({ message: 'All fields are required.' });
    }

    const newMedia = {
        developer,
        project,
        service,
        date,
    };

    const savedMedia = mediaData.addItem(newMedia); // Save form data

    if (req.file) {
        const fileName = `${savedMedia._id}${path.extname(req.file.originalname)}`;
        const filePath = path.join(process.env.MEDIA_PATH, 'files/', fileName);

        // Move the uploaded file to the specified directory
        fs.rename(req.file.path, filePath, (err) => {
            if (err) {
                console.error('Error saving file:', err);
                return res.status(500).json({ message: 'Failed to save file.' });
            }

            // Update media data with the file path
            const finalMedia = mediaData.updateItem(savedMedia._id, { file: `files/${fileName}` });
            return res.status(201).json(finalMedia);
        });
    } else {
        return res.status(201).json(savedMedia); // Respond with saved media data
    }
}

module.exports = {
    handleMediaForm,
};
