# S3 Private Bucket Setup with Signed URLs

## Overview
Your S3 bucket (iDrive e2) is private, so we use **presigned URLs** (signed URLs) to provide temporary, secure access to files without making the bucket public.

## How It Works

### 1. **Upload Process**
When a file is uploaded:
- File is uploaded to S3 bucket
- A **presigned URL** is generated (valid for 7 days)
- The presigned URL is stored in the database
- Users can access the file using this URL

### 2. **Presigned URLs**
- **Valid for**: 7 days (configurable)
- **Secure**: Temporary access without exposing bucket credentials
- **Automatic**: Generated during upload
- **Refreshable**: Can generate new URLs if expired

## Backend Implementation

### Upload Response
When uploading attachments, the response includes:
```json
{
  "url": "https://s3.ap-southeast-1.idrivee2.com/attachments/...?X-Amz-Algorithm=...&X-Amz-Signature=...",
  "s3Key": "attachments/tasks/123/file.pdf",
  "directUrl": "https://s3.ap-southeast-1.idrivee2.com/attachments/..."
}
```

The `url` field is the presigned URL that should be used to access the file.

### Refresh Expired URLs
If a presigned URL expires, you can get a new one:

**Endpoint**: `POST /api/attachments/presigned-url`
**Headers**: `Authorization: Bearer YOUR_TOKEN`
**Body**:
```json
{
  "url": "https://s3.ap-southeast-1.idrivee2.com/attachments/...",
  // OR
  "key": "attachments/tasks/123/file.pdf"
}
```

**Response**:
```json
{
  "success": true,
  "url": "https://s3.ap-southeast-1.idrivee2.com/attachments/...?X-Amz-Algorithm=...&X-Amz-Signature=...",
  "key": "attachments/tasks/123/file.pdf"
}
```

## Frontend Usage

### Displaying Attachments
The frontend automatically handles presigned URLs:
- If URL starts with `http://` or `https://`, it's used directly (includes presigned URLs)
- Presigned URLs work in `<img>`, `<a>`, or any HTML element that uses URLs

### Example Usage
```html
<!-- Direct use in template -->
<img [src]="attachment.url" />
<a [href]="attachment.url" target="_blank">Download</a>
```

```typescript
// In component
getAttachmentUrl(url: string): string {
  // Presigned URLs already start with https://, so they work directly
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url; // This is a presigned URL
  }
  // Handle local storage URLs if any
  return `${this.mediaBaseUrl}${url}`;
}
```

### Handling Expired URLs
If a URL expires (after 7 days), you can refresh it:

```typescript
async refreshAttachmentUrl(attachment: Attachment): Promise<string> {
  try {
    const response = await this.http.post<{url: string}>(
      `${this.apiUrl}/attachments/presigned-url`,
      { url: attachment.url } // or { key: attachment.s3Key }
    ).toPromise();
    
    return response.url;
  } catch (error) {
    console.error('Failed to refresh URL:', error);
    return attachment.url; // Fallback to original
  }
}
```

## Configuration

### Expiration Time
Default: **7 days** (604,800 seconds)

To change expiration time, edit `backend/utils/s3Service.js`:
```javascript
// In uploadToS3 function
const presignedUrl = await getPresignedUrl(key, 7 * 24 * 60 * 60); // 7 days
// Change to:
const presignedUrl = await getPresignedUrl(key, 30 * 24 * 60 * 60); // 30 days
```

### Maximum Expiration
- Most S3 services allow up to 7 days
- Some allow longer (check your S3 provider documentation)

## Benefits of Private Buckets

✅ **Security**: Files are not publicly accessible
✅ **Access Control**: Only users with presigned URLs can access files
✅ **Temporary Access**: URLs expire automatically
✅ **No Public Exposure**: Bucket remains private

## Testing

### Test Upload
1. Upload an attachment via API
2. Check the response - `url` should be a presigned URL (long URL with query parameters)
3. Copy the URL and open in browser - file should be accessible

### Test Expiration
1. Wait for URL to expire (or manually test with expired URL)
2. Call `/api/attachments/presigned-url` to get a new URL
3. New URL should work

## Notes

- Presigned URLs work like normal URLs in the frontend
- No special handling needed for `<img>` or `<a>` tags
- URLs include authentication signature in query parameters
- URLs are long but function normally

