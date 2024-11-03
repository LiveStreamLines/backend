// controllers/videoController.js
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Define the root directory for camera pictures and the output directory for videos
const mediaRoot = 'C:/media/upload';
const videoOutputDir = 'C:/media/videos';

exports.generateVideo = (req, res) => {
  const { developerId, projectId, cameraId } = req.params;
  const { date1, date2, hour1 = '0000', hour2 = '2359' } = req.query;

  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');

  // Check if the camera directory exists
  if (!fs.existsSync(cameraPath)) {
    return res.status(404).json({ error: 'Camera directory not found' });
  }

  // Read and filter image files by date and time range
  const files = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));
  const sortedFiles = files.sort();

  const startDateTime = `${date1}${hour1}`;
  const endDateTime = `${date2}${hour2}`;

  const filteredPics = sortedFiles.filter(file => {
    const timestamp = file.slice(0, 12); // Extract YYYYMMDDHHMM from the filename
    return timestamp >= startDateTime && timestamp <= endDateTime;
  });

  if (filteredPics.length === 0) {
    return res.status(404).json({ error: 'No pictures found in the specified date and time range' });
  }

  // Define the temporary directory for filtered images
  const tempDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  // Copy filtered images to the temporary directory and rename for FFmpeg
  filteredPics.forEach((file, index) => {
    const oldPath = path.join(cameraPath, file);
    const newPath = path.join(tempDir, `img${String(index).padStart(4, '0')}.jpg`);
    fs.copyFileSync(oldPath, newPath);
  });

  // Define the output video path and FFmpeg command
  const videoFilename = `video_${developerId}_${projectId}_${cameraId}_${Date.now()}.mp4`;
  const outputVideoPath = path.join(videoOutputDir, videoFilename);
  const ffmpegCommand = `ffmpeg -framerate 1 -i ${tempDir}/img%04d.jpg -c:v libx264 -r 30 -pix_fmt yuv420p "${outputVideoPath}"`;

  // Run the FFmpeg command to generate the video
  exec(ffmpegCommand, (error, stdout, stderr) => {
    // Clean up the temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });

    if (error) {
      console.error(`FFmpeg error: ${stderr}`);
      return res.status(500).json({ error: 'Failed to generate video' });
    }

    res.json({
      message: 'Video generated successfully',
      videoPath: `${req.protocol}://${req.get('host')}/media/videos/${videoFilename}`
    });
  });
};
