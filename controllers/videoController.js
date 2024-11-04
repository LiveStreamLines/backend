const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

const mediaRoot = 'C:/media/upload';

function generateVideo(req, res) {
  const { developerId, projectId, cameraId, date1, date2, hour1, hour2, videoDuration, framerate, imageListFile } = req.body;

  // Define the camera folder path
  const cameraPath = path.join(mediaRoot, developerId, projectId, cameraId, 'large');

  // Check if the camera directory exists
  if (!fs.existsSync(cameraPath)) {
    return res.status(404).json({ error: 'Camera directory not found' });
  }

  // Read all image files in the camera directory
  const allFiles = fs.readdirSync(cameraPath).filter(file => file.endsWith('.jpg'));

  // Filter files based on date range
  const filteredByDate = allFiles.filter(file => {
    const fileDate = file.substring(0, 8); // Extract YYYYMMDD from filename
    return fileDate >= date1 && fileDate <= date2;
  });

  // Further filter by hour range within the filtered dates
  const finalFilteredFiles = filteredByDate.filter(file => {
    const fileHour = file.substring(8, 10); // Extract HH from filename
    return fileHour >= hour1 && fileHour <= hour2;
  });

  // Check if we have images after filtering
  if (finalFilteredFiles.length === 0) {
    return res.status(404).json({ error: 'No pictures found for the specified date and hour range' });
  }

  // Full paths for each image file, used for video generation
  const imagePaths = finalFilteredFiles.map(file => path.join(cameraPath, file));

  // Optionally read image paths from a text file if provided
  if (imageListFile) {
    const imageListPath = path.join(cameraPath, imageListFile);
    if (fs.existsSync(imageListPath)) {
      const fileImagePaths = fs.readFileSync(imageListPath, 'utf-8')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line !== ''); // Remove any empty lines

      // Combine paths from the text file with the filtered files
      imagePaths.push(...fileImagePaths);
    } else {
      return res.status(404).json({ error: 'Image list file not found' });
    }
  }

  // Define the output video path
  const outputVideoPath = path.join(cameraPath, 'output_video.mp4');

  // Use FFmpeg to generate the video from the filtered images
  ffmpeg()
    .input(imagePaths.join('|')) // Join image paths with pipe for glob pattern
    .inputOptions(['-pattern_type glob'])
    .outputOptions([
      `-framerate ${framerate}`,  // Use specified frame rate from the request
      `-vf scale=3840:2160`,      // Scale to 4K resolution
      '-c:v libx264',             // Use H.264 codec
      '-crf 18',                  // Set CRF for quality
      '-preset slow',             // Use a slower preset for better quality
      '-pix_fmt yuv420p',        // Set pixel format for compatibility
      '-t', videoDuration         // Set video duration
    ])
    .output(outputVideoPath) // Specify output file
    .on('end', () => {
      const fileSize = fs.statSync(outputVideoPath).size; // Get file size in bytes
      res.json({
        message: 'Video generated successfully',
        videoPath: outputVideoPath,
        filteredCount: imagePaths.length, // Number of filtered pictures
        videoDuration: videoDuration,       // Video length in seconds
        fileSize: fileSize                  // File size in bytes
      });
    })
    .on('error', err => {
      console.error(err);
      res.status(500).json({ error: 'Failed to generate video' });
    })
    .run();
}

module.exports = {
  generateVideo
};
