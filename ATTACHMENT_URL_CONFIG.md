# Attachment URL Configuration

## Problem
When deploying to production, attachment URLs were being generated as:
```
https://lsl-platform.com/media/attachments/projects/...
```

But they should be:
```
https://lsl-platform.com/backend/media/attachments/projects/...
```

## Solution
The backend now uses an environment variable `ATTACHMENT_BASE_URL` to configure the base URL for attachment links.

## Configuration

### For Local Development:
```bash
# No environment variable needed - defaults to /backend
# URLs will be: http://localhost:5000/backend/media/attachments/...
```

### For Production:
```bash
# Set the environment variable
export ATTACHMENT_BASE_URL="/backend"

# Or in your .env file:
ATTACHMENT_BASE_URL=/backend
```

### For Different Deployments:
```bash
# If your backend is served at a different path:
export ATTACHMENT_BASE_URL="/api"

# If no prefix is needed:
export ATTACHMENT_BASE_URL=""
```

## How It Works

1. **URL Generation**: When uploading attachments, the backend generates URLs using:
   ```javascript
   url: `${getAttachmentBaseUrl()}/media/attachments/projects/${projectId}/${file.filename}`
   ```

2. **Environment Variable**: The `getAttachmentBaseUrl()` function returns:
   - `process.env.ATTACHMENT_BASE_URL` if set
   - `/backend` as default if not set

3. **Result**: Attachment URLs will be properly formatted for your deployment environment.

## Testing

To test the configuration:

1. **Upload an attachment** through the project info modal
2. **Check the generated URL** in the response
3. **Verify the URL works** by clicking the "Open/View" button
4. **Confirm the file loads** in a new browser tab

## Deployment Notes

Make sure to set the `ATTACHMENT_BASE_URL` environment variable in your production environment to match your server configuration.
