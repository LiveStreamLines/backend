const path = require('path');
const fs = require('fs');
const mediaData = require('../models/mediaData'); // Assuming a similar structure like developerData.js

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
        files: []
    };

    const savedMedia = mediaData.addItem(newMedia); // Save form data

    if (req.files && req.files.length > 0) {
       // Iterate over each file and move it to the target directory
       const filePromises = req.files.map((file) => {
        const fileName = `${savedMedia._id}-${Date.now()}-${file.originalname}`;
        const filePath = path.join(process.env.MEDIA_PATH, 'files/', fileName);

        return new Promise((resolve, reject) => {
            fs.rename(file.path, filePath, (err) => {
                if (err) {
                    console.error('Error saving file:', err);
                    reject(err);
                } else {
                    newMedia.files.push(`files/${fileName}`); // Add file path to the media object
                    resolve();
                }
            });
        });
    });

    // Wait for all files to be processed
    Promise.all(filePromises)
        .then(() => {
            mediaData.updateItem(savedMedia._id, { files: newMedia.files });
            res.status(201).json({ ...savedMedia, files: newMedia.files });
        })
        .catch((err) => {
            console.error('Error processing files:', err);
            res.status(500).json({ message: 'Failed to process files.' });
        });
    } else {
        return res.status(201).json(savedMedia); // Respond with saved media data
    }
}

module.exports = {
    handleMediaForm,
};
