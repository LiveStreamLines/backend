// server.js
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();


const logoRoutes = require('./routes/logo');
const authRoutes = require('./routes/auth');
const developerRoutes = require('./routes/developers');
const projectRoutes = require('./routes/projects');
const cameraRoutes = require('./routes/cameras');
const userRoutes = require('./routes/users');
const cameraPicsRoutes = require ('./routes/camerapics');
const videoRoutes = require ('./routes/video');
const weatherRoutes = require ('./routes/weather');
const mediaRoutes = require ('./routes/media');
const otpRoutes = require('./routes/otp');
const studioRoutes = require('./routes/studio');


const app = express();

app.use(cors());
app.use(bodyParser.json());

// Increase payload size limit
app.use(express.json({ limit: '50mb' })); // Adjust the limit as needed
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware to serve static files for media
app.use('/media/upload', express.static(process.env.MEDIA_PATH +'/upload'));
app.use('/canvas_images', express.static(process.env.MEDIA_PATH +'/canvas_images'));
app.use('/media/music', express.static(process.env.MEDIA_PATH+'/music'));

// Use routes
app.use('/logos', logoRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/developers', developerRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/cameras', cameraRoutes);
app.use('/api/users', userRoutes);
app.use('/api/camerapics', cameraPicsRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/otp', otpRoutes);
app.use('/api/studio', studioRoutes);


const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
