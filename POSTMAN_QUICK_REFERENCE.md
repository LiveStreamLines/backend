# Postman Quick Reference - S3 Attachment Testing

## Quick Steps

### 1. Login & Get Token
```
POST http://YOUR_SERVER:5000/api/operation-auth/login
Content-Type: application/json

{
  "email": "your-email@example.com",
  "password": "your-password"
}
```
→ Copy the `token` from response

---

### 2. Create Task with Attachment
```
POST http://YOUR_SERVER:5000/api/tasks
Authorization: Bearer YOUR_TOKEN_HERE
Body Type: form-data

Fields:
- title: Test Task
- description: Test Description  
- type: Bug
- assignee: assignee_user_id
- attachments: [Select File(s)]
```

---

### 3. Create Maintenance Task with Attachment
```
POST http://YOUR_SERVER:5000/api/maintenance
Authorization: Bearer YOUR_TOKEN_HERE
Body Type: form-data

Fields:
- title: Maintenance Task
- description: Description
- priority: High
- status: open
- attachments: [Select File(s)]
```

---

### 4. Verify S3 Upload
Check response for:
- `url` field contains S3 URL: `https://s3.ap-southeast-1.idrivee2.com/attachments/...`
- `s3Key` field is present
- Open the URL in browser to verify file access

---

## Important Notes

- ✅ All endpoints require `Authorization: Bearer TOKEN` header
- ✅ Use `form-data` body type (not raw JSON) for file uploads
- ✅ Max file size: 10MB per file
- ✅ Max files: 10 per request
- ✅ Temp files are auto-deleted after S3 upload

## Troubleshooting

- **401 Unauthorized**: Check token in Authorization header
- **S3 Upload Failed**: Check backend logs, verify S3 credentials
- **File Not Accessible**: Check S3 bucket permissions and URL format

