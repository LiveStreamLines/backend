# Project Attachments API Endpoints

## Overview
This document describes the new attachment endpoints added to the project API for managing file attachments associated with projects.

## Endpoints

### 1. Upload Project Attachment
**POST** `/api/projects/:projectId/attachments`

Upload a file attachment to a specific project.

**Parameters:**
- `projectId` (string): The ID of the project
- `file` (multipart/form-data): The file to upload

**Request:**
```bash
curl -X POST \
  http://localhost:5000/api/projects/{projectId}/attachments \
  -H 'Authorization: Bearer {token}' \
  -F 'file=@/path/to/file.pdf'
```

**Response:**
```json
{
  "_id": "attachment_id",
  "name": "filename_timestamp.ext",
  "originalName": "original_filename.ext",
  "size": 1024,
  "type": "application/pdf",
  "url": "/media/attachments/projects/{projectId}/filename_timestamp.ext",
  "uploadedAt": "2024-01-01T00:00:00.000Z",
  "uploadedBy": "user_id"
}
```

### 2. Get Project Attachments
**GET** `/api/projects/:projectId/attachments`

Retrieve all attachments for a specific project.

**Parameters:**
- `projectId` (string): The ID of the project

**Request:**
```bash
curl -X GET \
  http://localhost:5000/api/projects/{projectId}/attachments \
  -H 'Authorization: Bearer {token}'
```

**Response:**
```json
[
  {
    "_id": "attachment_id",
    "name": "filename_timestamp.ext",
    "originalName": "original_filename.ext",
    "size": 1024,
    "type": "application/pdf",
    "url": "/media/attachments/projects/{projectId}/filename_timestamp.ext",
    "uploadedAt": "2024-01-01T00:00:00.000Z",
    "uploadedBy": "user_id"
  }
]
```

### 3. Delete Project Attachment
**DELETE** `/api/projects/:projectId/attachments/:attachmentId`

Delete a specific attachment from a project.

**Parameters:**
- `projectId` (string): The ID of the project
- `attachmentId` (string): The ID of the attachment to delete

**Request:**
```bash
curl -X DELETE \
  http://localhost:5000/api/projects/{projectId}/attachments/{attachmentId} \
  -H 'Authorization: Bearer {token}'
```

**Response:**
```json
{
  "message": "Attachment deleted successfully"
}
```

## File Storage

### Directory Structure
```
{MEDIA_PATH}/attachments/projects/
├── {projectId1}/
│   ├── file1_timestamp.ext
│   └── file2_timestamp.ext
└── {projectId2}/
    └── file3_timestamp.ext
```

### File Access
Files are served statically at:
```
http://localhost:5000/media/attachments/projects/{projectId}/{filename}
```

## Configuration

### File Size Limits
- Maximum file size: 10MB per file
- Configured in `routes/projects.js`

### Supported File Types
All file types are supported. The system preserves original file extensions and MIME types.

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "message": "No file uploaded"
}
```

**404 Not Found:**
```json
{
  "message": "Project not found"
}
```

**404 Not Found:**
```json
{
  "message": "Attachment not found"
}
```

**500 Internal Server Error:**
```json
{
  "message": "Error uploading project attachment"
}
```

## Database Schema

### Project Model Updates
The project model now includes an optional `attachments` array:

```javascript
{
  "_id": "project_id",
  "projectName": "Project Name",
  // ... other project fields
  "attachments": [
    {
      "_id": "attachment_id",
      "name": "filename_timestamp.ext",
      "originalName": "original_filename.ext",
      "size": 1024,
      "type": "application/pdf",
      "url": "/media/attachments/projects/{projectId}/filename_timestamp.ext",
      "uploadedAt": "2024-01-01T00:00:00.000Z",
      "uploadedBy": "user_id"
    }
  ]
}
```

## Security

- All endpoints require authentication via `authMiddleware`
- File uploads are limited to 10MB per file
- Files are stored in project-specific directories
- Original filenames are preserved in metadata but not used for storage

## Frontend Integration

The frontend Angular service (`ProjectService`) includes methods for:
- `uploadProjectAttachment(projectId, file)`
- `getProjectAttachments(projectId)`
- `deleteProjectAttachment(projectId, attachmentId)`

These methods handle the HTTP requests and file uploads automatically.
