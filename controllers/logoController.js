// controllers/logoController.js
const fs = require('fs');
const path = require('path');

// Define the root directory for logos
const logoRoot = process.env.MEDIA_PATH + '/logos';

// Controller function to serve logos
function serveLogo(req, res) {
  const { type, filename } = req.params;

  // Construct the path based on the type (e.g., developer or project) and filename
  const filePath = path.join(logoRoot, type, filename);

  // Check if the file exists and serve it
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Logo file not found' });
  }
};

module.exports = {
    serveLogo
 };