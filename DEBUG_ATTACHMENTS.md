# Debugging Attachment Upload Issues

## Current Issues to Check

### 1. Verify Files Are Being Received
Add this logging at the start of `createMaintenance`:
```javascript
logger.info('Request received:', {
    hasFiles: !!req.files,
    filesCount: req.files ? req.files.length : 0,
    files: req.files ? req.files.map(f => ({ name: f.originalname, path: f.path, size: f.size })) : []
});
```

### 2. Check S3 Configuration
Verify in `backend/utils/s3Service.js`:
- ✅ Endpoint: `https://s3.ap-southeast-1.idrivee2.com`
- ✅ Credentials are set
- ✅ Bucket name is correct (default: `attachments`)
- ✅ AWS SDK packages are installed

### 3. Test S3 Connection
The S3 upload might be failing. Check backend logs for:
- `Error uploading file to S3:`
- `Error uploading attachment to S3:`
- `Failed to upload file to S3:`

### 4. Common Issues

#### Issue: Files Not Received
**Symptom**: `req.files` is undefined or empty
**Solution**: 
- Check multer configuration in `routes/maintenance.js`
- Verify Content-Type is `multipart/form-data`
- Ensure field name matches: `attachments`

#### Issue: S3 Upload Fails
**Symptoms**: 
- Error in logs about S3 upload
- Files not appearing in S3 bucket
- 500 error responses

**Possible Causes**:
1. **AWS SDK not installed**: Run `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`
2. **Incorrect credentials**: Check S3 credentials in `s3Service.js`
3. **Network/firewall**: Server can't reach S3 endpoint
4. **Bucket doesn't exist**: Create bucket `attachments` in your S3 console
5. **Bucket permissions**: Ensure credentials have PutObject permission

#### Issue: Attachments Not Saved
**Symptoms**:
- Upload succeeds but attachments not in response
- Attachments array is empty in database

**Solution**: 
- Check if `updateItem` is working correctly
- Verify maintenance object is being updated before response

### 5. Testing Steps

1. **Test File Reception**:
   - Check backend logs when uploading
   - Look for: `Processing X attachment(s) for maintenance task`
   - Verify file paths exist

2. **Test S3 Upload**:
   - Check for: `Uploading to S3 with key: ...`
   - Check for: `Successfully uploaded to S3: ...`
   - If errors, check S3 credentials and network

3. **Test Database Update**:
   - Check for: `Updating maintenance task ... with X attachment(s)`
   - Check for: `Successfully updated maintenance task with attachments`
   - Verify response includes attachments array

### 6. Manual S3 Test

You can test S3 connection directly:

```javascript
// Test script: test-s3.js
const s3Service = require('./utils/s3Service');
const fs = require('fs');

async function testS3() {
    try {
        const testKey = 'test/test-file.txt';
        const testContent = Buffer.from('Hello S3!');
        
        console.log('Testing S3 upload...');
        const result = await s3Service.uploadToS3(
            testContent,
            testKey,
            'text/plain',
            'test-file.txt'
        );
        
        console.log('Success! URL:', result.url);
        
        // Clean up
        await s3Service.deleteFromS3(testKey);
        console.log('Test file deleted');
    } catch (error) {
        console.error('S3 Test Failed:', error);
    }
}

testS3();
```

Run: `node test-s3.js`

### 7. Postman Testing Checklist

- [ ] Files are included in request (check Postman request body)
- [ ] Authorization header is set with valid token
- [ ] Content-Type is automatically set to `multipart/form-data`
- [ ] Field name is exactly `attachments` (case-sensitive)
- [ ] Response includes attachments array
- [ ] Check backend logs for errors

### 8. What to Look For in Logs

**Success indicators**:
```
Processing 1 attachment(s) for maintenance task abc123
Processing file: test.pdf, path: /path/to/temp/file
Uploading to S3 with key: attachments/maintenance/abc123/...
Successfully uploaded to S3: https://...
Added attachment to array: xyz789
Updating maintenance task abc123 with 1 attachment(s)
Successfully updated maintenance task with attachments
```

**Error indicators**:
```
Error uploading attachment to S3: ...
File not found at temp path: ...
Error processing attachments: ...
Failed to update maintenance task ... with attachments
```

### 9. Quick Fixes

If S3 is not accessible, you can temporarily disable S3 and use local storage:

1. Comment out S3 upload code
2. Use local file storage temporarily
3. Test that files are received
4. Then re-enable S3 and fix S3-specific issues

### 10. Environment Variables to Check

Make sure these are set if needed:
- `S3_BUCKET_NAME` (defaults to `attachments`)
- `MEDIA_PATH` (for temp file storage)

