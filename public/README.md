# Camera Widget - Setup and Testing Guide

## 🚀 Quick Start

Your backend is configured to serve the camera widget at:
- Widget URL: `https://lsl-platform.com/backend/public/camera-widget.html`
- Example Page: `https://lsl-platform.com/backend/public/iframe-example.html`

## 📝 Testing Steps

### 1. Restart the Backend Server
```bash
# If using PM2
pm2 restart winjy-erp --update-env

# Or if running directly
npm start
```

### 2. Test Direct Access
Open your browser and navigate to:
```
https://lsl-platform.com/backend/public/camera-widget.html?projectId=YOUR_PROJECT&cameraId=YOUR_CAMERA&token=YOUR_TOKEN
```

Replace:
- `YOUR_PROJECT` - with your actual project ID
- `YOUR_CAMERA` - with your actual camera ID
- `YOUR_TOKEN` - with your authentication token

### 3. Test Iframe Embedding
On any website, add:
```html
<iframe 
    src="https://lsl-platform.com/backend/public/camera-widget.html?projectId=YOUR_PROJECT&cameraId=YOUR_CAMERA&token=YOUR_TOKEN" 
    width="600" 
    height="500" 
    frameborder="0"
    allowfullscreen>
</iframe>
```

## 🔧 Configuration

### Option 1: URL Parameters (Recommended)
Pass configuration through URL query parameters:
- `projectId` - Your project identifier
- `cameraId` - Your camera identifier  
- `token` - Your authentication token

### Option 2: Edit Default Values
Edit `public/camera-widget.html` and update the default values in the `config` object:
```javascript
this.config = {
    projectId: 'your-project-id',    // Replace with actual project ID
    cameraId: 'your-camera-id',      // Replace with actual camera ID
    developerId: 'seeb',
    authToken: 'your-auth-token'     // Replace with actual auth token
};
```

## 🌐 API Endpoint

The widget calls:
```
POST https://lsl-platform.com/backend/api/get-image/:projectId/:cameraId/
```

With body:
```json
{
  "day1": "YYYYMMDD",
  "time1": "HHMMSS"
}
```

## ✨ Features

- ✅ Auto-refresh every 30 minutes
- ✅ Shows latest image from the last hour
- ✅ Responsive design
- ✅ Error handling with retry logic
- ✅ Loading states and status indicators
- ✅ Iframe-compatible styling

## 🐛 Troubleshooting

### Widget shows "Connection failed"
- Check that your authentication token is valid
- Verify the project ID and camera ID are correct
- Check browser console for detailed error messages

### No images available
- Ensure there are images in the camera directory from the last hour
- Verify the camera path exists: `/media/upload/seeb/[projectId]/[cameraId]/large/`

### CORS Issues
- Your nginx configuration should already handle this
- If issues persist, check nginx CORS headers

## 📂 File Structure

```
public/
├── camera-widget.html      # Main widget file (embeddable)
├── iframe-example.html     # Example page with multiple sizes
└── README.md              # This file
```

## 🔄 How It Works

1. Widget fetches images from the last hour using the get-image API
2. Displays the most recent image (last in sorted array)
3. Automatically refreshes every 30 minutes
4. Handles errors with 3 retry attempts (exponential backoff)
5. Shows loading/error states appropriately

## 📱 Responsive Sizes

The widget is fully responsive. Recommended iframe sizes:
- **Small**: 400x300px (mobile-friendly)
- **Medium**: 600x400px (tablet/desktop)
- **Large**: 800x500px (large displays)

## 🔐 Security Notes

- The authentication token is passed via URL parameters
- For production, consider implementing a secure token exchange
- Use HTTPS for all production deployments (already configured)

