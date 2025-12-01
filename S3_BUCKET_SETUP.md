# S3 Bucket Setup Instructions

## Issue
The error shows: `The specified bucket does not exist` for bucket name: `attachments`

## Solution Options

### Option 1: Create Bucket Manually (Recommended)
1. Log into your S3 management console at: `https://s3.ap-southeast-1.idrivee2.com`
2. Create a new bucket named: `attachments`
3. Ensure the bucket is in region: `ap-southeast-1`
4. Set appropriate permissions

### Option 2: Use Existing Bucket
If you have an existing bucket you want to use:

1. Set environment variable:
   ```bash
   export S3_BUCKET_NAME=your-existing-bucket-name
   ```

2. Or add to your `.env` file:
   ```
   S3_BUCKET_NAME=your-existing-bucket-name
   ```

### Option 3: Auto-Creation (May Not Work)
The code now attempts to create the bucket automatically, but this may fail if:
- Your S3 service doesn't allow programmatic bucket creation
- You don't have permission to create buckets
- The bucket creation requires additional configuration

## Current Configuration
- **Bucket Name**: `attachments` (default) or from `S3_BUCKET_NAME` env variable
- **Endpoint**: `s3.ap-southeast-1.idrivee2.com`
- **Region**: `ap-southeast-1`

## After Creating the Bucket
1. Restart your backend server
2. Try uploading an attachment again
3. Check logs to verify upload success

## Verify Bucket Creation
After creating the bucket, you should see in logs:
```
S3 bucket "attachments" exists
```

Or if auto-creation worked:
```
Successfully created S3 bucket "attachments"
```

