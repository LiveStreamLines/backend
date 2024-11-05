// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const developerRoutes = require('./routes/developers');
const projectRoutes = require('./routes/projects');
const cameraRoutes = require('./routes/cameras');
const userRoutes = require('./routes/users');
const cameraPicsRoutes = require ('./routes/camerapics');
//const videoRoutes = require ('./routes/video');


const app = express();

app.use(cors());
app.use(bodyParser.json());

// Middleware to serve static files for media
app.use('/media/upload', express.static(process.env.MEDIA_PATH +'/upload'));


const logoRoot = process.env.MEDIA_PATH +'/logos';

// Route to serve developer and project logos
app.get('/logos/:type/:filename', (req, res) => {
  const { type, filename } = req.params;

  // Construct the path based on the type (e.g., developer or project) and filename
  const filePath = path.join(logoRoot, type, filename);

  // Check if the file exists and serve it
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Logo file not found' });
  }
});


// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/developers', developerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/users', userRoutes);
app.use('/api/camerapics', cameraPicsRoutes);
//app.use('/api/video', videoRoutes);



const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
