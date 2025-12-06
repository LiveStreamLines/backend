# Guide: Uploading and Serving Camera Images from S3 Bucket

This guide explains how to upload camera images to your iDrive E2 S3 bucket and test serving them through the S3 test controller.

## Prerequisites

1. **S3 Bucket Created**: You need a bucket in your iDrive E2 account
2. **Credentials Configured**: Your `.env` file should have the S3 camera configuration
3. **Images Ready**: Have some test images (JPG files) ready to upload

## Step 1: Check Your Bucket Configuration

First, verify your bucket name and credentials:

```bash
cd backend
node check-s3-buckets.js
```

This will list all available buckets. Note the bucket name you want to use.

## Step 2: Update .env File

Make sure your `.env` file has the correct bucket name:

```env
S3_CAMERA_BUCKET_NAME=your-bucket-name-here
S3_CAMERA_ENDPOINT=https://s3.ap-southeast-1.idrivee2.com
S3_CAMERA_REGION=ap-southeast-1
S3_CAMERA_ACCESS_KEY_ID=your-access-key
S3_CAMERA_SECRET_ACCESS_KEY=your-secret-key
```

## Step 3: Upload Images to S3

### Option A: Using the Upload Script (Recommended)

The upload script automatically creates the correct folder structure:

```bash
# Upload a single image
node upload-camera-images-to-s3.js camera-pictures dev1 proj1 cam1 ./test-images/20240101120000.jpg

# Upload multiple images
node upload-camera-images-to-s3.js camera-pictures dev1 proj1 cam1 ./test-images/*.jpg

# List available buckets
node upload-camera-images-to-s3.js list
```

**Important**: The filename format should be `YYYYMMDDHHMMSS.jpg` (e.g., `20240101120000.jpg`) to match the expected format in the controller.

### Option B: Using iDrive E2 Web Console

1. Log into your iDrive E2 console: `https://s3.ap-southeast-1.idrivee2.com`
2. Navigate to your bucket
3. Create the folder structure: `upload/{developerId}/{projectId}/{cameraId}/large/`
4. Upload your images to the `large` folder
5. Ensure filenames follow the format: `YYYYMMDDHHMMSS.jpg`

### Option C: Using AWS CLI (if configured)

```bash
aws s3 cp ./test-images/20240101120000.jpg \
  s3://camera-pictures/upload/dev1/proj1/cam1/large/20240101120000.jpg \
  --endpoint-url https://s3.ap-southeast-1.idrivee2.com
```

## Step 4: Verify Images Are Uploaded

Check that your images are in the bucket:

```bash
# Using the upload script
node upload-camera-images-to-s3.js list
```

Or check in your iDrive E2 web console.

## Step 5: Add Test Routes to Server

Add the S3 test routes to your `backend/server.js`:

```javascript
const cameraPicsS3TestRoutes = require('./routes/camerapicsS3Test');

// ... other routes ...

app.use('/api/camerapics-s3-test', cameraPicsS3TestRoutes);
```

Then restart your server.

## Step 6: Test the Endpoints

### Test 1: Get Camera Pictures

```bash
POST http://localhost:5000/api/camerapics-s3-test/dev1/proj1/cam1/pictures/
Content-Type: application/json

{
  "date1": "20240101",
  "date2": "20240102"
}
```

Or using curl:

```bash
curl -X POST http://localhost:5000/api/camerapics-s3-test/dev1/proj1/cam1/pictures/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"date1": "20240101", "date2": "20240102"}'
```

### Test 2: Get Camera Preview (Weekly Images)

```bash
GET http://localhost:5000/api/camerapics-s3-test/preview/dev1/proj1/cam1/
```

### Test 3: Get Emaar Pictures

```bash
GET http://localhost:5000/api/camerapics-s3-test/emaar/dev1/proj1/cam1
```

## Expected Response Format

### getCameraPictures Response:
```json
{
  "firstPhoto": "20240101120000",
  "lastPhoto": "20240102120000",
  "date1Photos": ["20240101120000", "20240101130000"],
  "date2Photos": ["20240102120000"],
  "path": "http://localhost:5000/media/upload/dev1/proj1/cam1/"
}
```

### getCameraPreview Response:
```json
{
  "weeklyImages": ["20240101120000", "20240108120000"],
  "path": "http://localhost:5000/media/upload/dev1/proj1/cam1/"
}
```

## Troubleshooting

### Issue: "No pictures found in camera directory"

**Possible causes:**
1. Bucket name is incorrect in `.env`
2. Images are not in the correct path structure
3. Images don't have `.jpg` extension
4. Credentials are incorrect

**Solution:**
- Verify bucket name: `node check-s3-buckets.js`
- Check the S3 path structure matches: `upload/{developerId}/{projectId}/{cameraId}/large/`
- Verify credentials in `.env`

### Issue: "Failed to list objects from S3"

**Possible causes:**
1. Network connectivity to S3 endpoint
2. Incorrect credentials
3. Bucket doesn't exist
4. Permissions issue

**Solution:**
- Test connection: `node check-s3-buckets.js`
- Verify credentials
- Check bucket exists in iDrive E2 console
- Ensure your credentials have `ListObjects` permission

### Issue: Images not showing in response

**Possible causes:**
1. Filename format doesn't match expected pattern
2. Images are in wrong folder
3. Date filters are excluding images

**Solution:**
- Use filename format: `YYYYMMDDHHMMSS.jpg`
- Verify folder structure
- Try without date filters first

## Image Filename Format

The controller expects filenames in this format:
- Format: `YYYYMMDDHHMMSS.jpg`
- Example: `20240101120000.jpg` (January 1, 2024, 12:00:00)
- Example: `20240115143000.jpg` (January 15, 2024, 14:30:00)

For weekly images, the controller looks for images taken at 12:00 (noon) on each week.

## S3 Bucket Structure

Your bucket should have this structure:

```
your-bucket-name/
└── upload/
    └── {developerId}/
        └── {projectId}/
            └── {cameraId}/
                └── large/
                    ├── 20240101120000.jpg
                    ├── 20240101130000.jpg
                    ├── 20240102120000.jpg
                    └── ...
```

## Security Notes

- The controller generates presigned URLs (valid for 7 days) for secure access
- Never commit your `.env` file to version control
- Keep your S3 credentials secure
- Consider using IAM policies to restrict access

## Next Steps

Once testing is successful:
1. Update the bucket name in production `.env`
2. Consider migrating existing images from local storage to S3
3. Update the main controller to use S3 instead of filesystem
4. Set up proper backup and monitoring

