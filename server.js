// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const path = require('path');
const fs = require('fs');

const logoRoutes = require('./routes/logo');
const authRoutes = require('./routes/auth');
const developerRoutes = require('./routes/developers');
const projectRoutes = require('./routes/projects');
const cameraRoutes = require('./routes/cameras');
const userRoutes = require('./routes/users');
const cameraPicsRoutes = require ('./routes/camerapics');
const videoRoutes = require ('./routes/video');
const weatherRoutes = require ('./routes/weather');


const app = express();

app.use(cors());
app.use(bodyParser.json());

// Middleware to serve static files for media
app.use('/media/upload', express.static(process.env.MEDIA_PATH +'/upload'));

// Use routes
app.use('/logos', logoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/developers', developerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/users', userRoutes);
app.use('/api/camerapics', cameraPicsRoutes);
app.use('/api/generate', videoRoutes);
app.use('/api/weather', weatherRoutes);



const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
