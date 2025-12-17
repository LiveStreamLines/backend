# Postman Testing Guide for S3 Attachment Uploads

## Prerequisites

1. Backend server must be running on your remote server (default port: 5000)
2. AWS SDK packages installed (`npm install` completed)
3. S3 credentials configured in `backend/utils/s3Service.js`

## Base URL Configuration

Replace `YOUR_SERVER_IP` or `YOUR_SERVER_DOMAIN` with your actual server address:

```
http://YOUR_SERVER_IP:5000
or
https://YOUR_SERVER_DOMAIN
```

## Step 1: Get Authentication Token

Before testing attachments, you need to authenticate first.

### Endpoint: Login
- **Method**: `POST`
- **URL**: `http://YOUR_SERVER_IP:5000/api/operation-auth/login`
- **Headers**: 
  - `Content-Type: application/json`
- **Body** (raw JSON):
```json
{
  "email": "your-email@example.com",
  "password": "your-password"
}
```

### Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "user_id",
    "email": "your-email@example.com",
    ...
  }
}
```

**Copy the `token` value** - you'll need it for all subsequent requests.

---

## Step 2: Test Task Attachment Upload

### Endpoint: Create Task with Attachments
- **Method**: `POST`
- **URL**: `http://YOUR_SERVER_IP:5000/api/tasks`
- **Headers**:
  - `Authorization: Bearer YOUR_TOKEN_HERE`
  - (Do NOT set `Content-Type` manually - Postman will set it automatically for multipart/form-data)
- **Body** (form-data):
  - `title`: `Test Task with S3 Attachment`
  - `description`: `Testing S3 upload functionality`
  - `type`: `Bug`
  - `assignee`: `assignee_user_id`
  - `concernedUsers`: JSON array string of user IDs (optional), e.g. `["userId1","userId2"]`
  - `notes`: `Initial note` (optional)
  - `attachments`: (Select "File" type) - Choose your test file(s)

### Example Postman Form-Data Setup:
```
Key                 Type    Value
title              Text    Test Task with S3 Attachment
description        Text    Testing S3 upload functionality
type               Text    Bug
assignee           Text    assignee_user_id_here
notes              Text    Initial note
attachments        File    [Select file(s) - can select multiple]
```

### Expected Response:
```json
{
  "_id": "task_id_here",
  "title": "Test Task with S3 Attachment",
  "status": "open",
  "attachments": [
    {
      "_id": "attachment_id",
      "name": "task_id_timestamp_random.ext",
      "originalName": "your_file.pdf",
      "size": 12345,
      "type": "application/pdf",
      "url": "https://s3.ap-southeast-1.idrivee2.com/attachments/attachments/tasks/task_id/file_name.ext",
      "s3Key": "attachments/tasks/task_id/file_name.ext",
      "uploadedAt": "2024-01-01T00:00:00.000Z",
      "uploadedBy": "user_id",
      "context": "initial"
    }
  ],
  ...
}
```

**Key Points:**
- The `url` field should contain the S3 URL (not local path)
- The `s3Key` field should be present
- Verify the file is actually uploaded to your S3 bucket

---

### Endpoint: Update Task with New Attachments
- **Method**: `PUT`
- **URL**: `http://YOUR_SERVER_IP:5000/api/tasks/{task_id}`
- **Headers**:
  - `Authorization: Bearer YOUR_TOKEN_HERE`
- **Body** (form-data):
  - `title`: `Updated Task Title` (optional)
  - `status`: `in_progress` (optional)
  - `attachments`: (Select "File" type) - Choose additional file(s)

---

### Endpoint: Add Note with Attachments
- **Method**: `POST`
- **URL**: `http://YOUR_SERVER_IP:5000/api/tasks/{task_id}/notes`
- **Headers**:
  - `Authorization: Bearer YOUR_TOKEN_HERE`
- **Body** (form-data):
  - `content`: `This is a note with an attachment`
  - `attachments`: (Select "File" type) - Choose file(s)

---

## Step 3: Test Maintenance (Internal Task) Attachment Upload

### Endpoint: Create Maintenance Task with Attachments
- **Method**: `POST`
- **URL**: `http://YOUR_SERVER_IP:5000/api/maintenance`
- **Headers**:
  - `Authorization: Bearer YOUR_TOKEN_HERE`
- **Body** (form-data):
  - `title`: `Test Maintenance Task`
  - `description`: `Testing maintenance attachments`
  - `cameraId`: `camera_id_here` (if applicable)
  - `priority`: `High`
  - `status`: `open`
  - `assistants`: `["assistant_id_1", "assistant_id_2"]` (JSON string or array)
  - `attachments`: (Select "File" type) - Choose your test file(s)

### Expected Response:
```json
{
  "_id": "maintenance_id_here",
  "title": "Test Maintenance Task",
  "attachments": [
    {
      "_id": "attachment_id",
      "name": "maintenance_id_timestamp_random.ext",
      "originalName": "your_file.pdf",
      "size": 12345,
      "type": "application/pdf",
      "url": "https://s3.ap-southeast-1.idrivee2.com/attachments/attachments/maintenance/maintenance_id/file_name.ext",
      "s3Key": "attachments/maintenance/maintenance_id/file_name.ext",
      "uploadedAt": "2024-01-01T00:00:00.000Z",
      "uploadedBy": "user_id",
      "context": "assignment"
    }
  ],
  ...
}
```

---

### Endpoint: Update Maintenance Task with Attachments (Completion)
- **Method**: `PUT`
- **URL**: `http://YOUR_SERVER_IP:5000/api/maintenance/{maintenance_id}`
- **Headers**:
  - `Authorization: Bearer YOUR_TOKEN_HERE`
- **Body** (form-data):
  - `status`: `completed`
  - `attachments`: (Select "File" type) - Completion photos/files

**Note**: When status is `completed`, attachments will have `context: "completion"`

---

## Step 4: Test File Retrieval

After uploading, you can verify the files are accessible:

1. **Check the S3 URL directly in browser**: Copy the `url` from the response and open it in a browser
2. **Verify in S3 bucket**: Log into your S3 management console and check the bucket

---

## Step 5: Test Delete (Cleans up S3 files)

### Endpoint: Delete Task
- **Method**: `DELETE`
- **URL**: `http://YOUR_SERVER_IP:5000/api/tasks/{task_id}`
- **Headers**:
  - `Authorization: Bearer YOUR_TOKEN_HERE`

This should also delete all associated attachments from S3.

---

## Troubleshooting

### Issue: 401 Unauthorized
- **Solution**: Make sure you're using a valid JWT token in the `Authorization` header
- Format: `Authorization: Bearer YOUR_TOKEN_HERE`

### Issue: 413 Payload Too Large
- **Solution**: File size limit is 10MB per file. Reduce file size or increase limit in route configuration.

### Issue: S3 Upload Failed
- **Check**:
  1. S3 credentials in `backend/utils/s3Service.js` are correct
  2. AWS SDK packages are installed (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`)
  3. Server has network access to S3 endpoint
  4. Check backend logs for specific error messages

### Issue: File uploaded but URL doesn't work
- **Check**:
  1. S3 bucket name is correct (default: `attachments`)
  2. S3 bucket permissions allow public read (if using public URLs)
  3. URL format matches your S3 endpoint configuration

### Issue: Files still in temp directory
- **Note**: Temp files should be automatically cleaned up after S3 upload
- If they persist, check file permissions and disk space

---

## Testing Checklist

- [ ] Successfully authenticate and get token
- [ ] Create task with single attachment
- [ ] Create task with multiple attachments
- [ ] Update task with additional attachments
- [ ] Add note with attachments to existing task
- [ ] Create maintenance task with attachments
- [ ] Update maintenance task to completed with attachments
- [ ] Verify files are accessible via S3 URLs
- [ ] Delete task and verify S3 files are also deleted
- [ ] Check backend logs for any errors

---

## Postman Collection Variables

For easier testing, set up Postman environment variables:

```
base_url: http://YOUR_SERVER_IP:5000
token: (set after login)
task_id: (set after creating task)
maintenance_id: (set after creating maintenance)
```

Then use: `{{base_url}}/api/tasks` instead of full URL.

---

## Example cURL Commands

### Create Task with Attachment:
```bash
curl -X POST http://YOUR_SERVER_IP:5000/api/tasks \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Test Task" \
  -F "description=Test Description" \
  -F "type=Bug" \
  -F "assignee=assignee_id" \
  -F "attachments=@/path/to/file.pdf"
```

### Create Maintenance with Attachment:
```bash
curl -X POST http://YOUR_SERVER_IP:5000/api/maintenance \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "title=Maintenance Task" \
  -F "description=Description" \
  -F "priority=High" \
  -F "status=open" \
  -F "attachments=@/path/to/file.pdf"
```

---

## Notes

1. All routes require authentication via JWT token
2. Maximum file size: 10MB per file
3. Maximum files per request: 10
4. Supported file types: All (no restriction)
5. Files are stored in S3 with structure: `attachments/{type}/{id}/{filename}`
6. Temp files are automatically cleaned up after upload
7. When deleting tasks/maintenance, all associated S3 files are also deleted

