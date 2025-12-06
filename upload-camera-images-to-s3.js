/**
 * Utility script to upload camera images to iDrive E2 S3 bucket
 * 
 * Usage:
 *   node upload-camera-images-to-s3.js <bucket-name> <developerId> <projectId> <cameraId> <image-path>
 * 
 * Example:
 *   node upload-camera-images-to-s3.js camera-pictures dev1 proj1 cam1 ./test-images/20240101120000.jpg
 * 
 * Or upload multiple images:
 *   node upload-camera-images-to-s3.js camera-pictures dev1 proj1 cam1 ./test-images/*.jpg
 */

const { S3Client, PutObjectCommand, ListBucketsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// S3 Configuration - uses environment variables or defaults
const S3_CONFIG = {
    endpoint: process.env.S3_CAMERA_ENDPOINT || 'https://s3.ap-southeast-1.idrivee2.com',
    region: process.env.S3_CAMERA_REGION || 'ap-southeast-1',
    credentials: {
        accessKeyId: process.env.S3_CAMERA_ACCESS_KEY_ID || 'fMZXDwBL2hElR6rEzgCW',
        secretAccessKey: process.env.S3_CAMERA_SECRET_ACCESS_KEY || 'gXrfsUVEDttGQBv3GIfjZvokZ4qrAFsOUywiN4TD'
    },
    forcePathStyle: true,
    signatureVersion: 'v4'
};

const s3Client = new S3Client(S3_CONFIG);

/**
 * List all available buckets
 */
async function listBuckets() {
    try {
        console.log('📦 Connecting to S3...\n');
        const command = new ListBucketsCommand({});
        const response = await s3Client.send(command);
        
        if (response.Buckets && response.Buckets.length > 0) {
            console.log('✓ Available buckets:');
            response.Buckets.forEach((bucket, index) => {
                console.log(`  ${index + 1}. ${bucket.Name}`);
            });
            console.log('');
            return response.Buckets.map(b => b.Name);
        } else {
            console.log('✗ No buckets found.');
            return [];
        }
    } catch (error) {
        console.error('✗ Error connecting to S3:');
        console.error(`  ${error.message}\n`);
        throw error;
    }
}

/**
 * Upload a single image to S3
 */
async function uploadImage(bucketName, developerId, projectId, cameraId, imagePath) {
    try {
        // Read the image file
        if (!fs.existsSync(imagePath)) {
            throw new Error(`File not found: ${imagePath}`);
        }

        const fileBuffer = fs.readFileSync(imagePath);
        const filename = path.basename(imagePath);
        
        // Ensure filename ends with .jpg
        const finalFilename = filename.endsWith('.jpg') ? filename : filename + '.jpg';
        
        // Construct S3 key: upload/{developerId}/{projectId}/{cameraId}/large/{filename}
        const s3Key = `upload/${developerId}/${projectId}/${cameraId}/large/${finalFilename}`;
        
        // Upload to S3
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
            Body: fileBuffer,
            ContentType: 'image/jpeg',
            Metadata: {
                'original-filename': filename,
                'uploaded-by': 'upload-script'
            }
        });

        await s3Client.send(command);
        
        console.log(`  ✓ Uploaded: ${s3Key}`);
        return s3Key;
    } catch (error) {
        console.error(`  ✗ Failed to upload ${imagePath}:`);
        console.error(`    ${error.message}`);
        throw error;
    }
}

/**
 * List objects in a bucket with a specific prefix
 */
async function listObjects(bucketName, prefix = '') {
    try {
        const command = new ListObjectsV2Command({
            Bucket: bucketName,
            Prefix: prefix
        });
        
        const response = await s3Client.send(command);
        return response.Contents || [];
    } catch (error) {
        console.error(`Error listing objects: ${error.message}`);
        return [];
    }
}

/**
 * Main function
 */
async function main() {
    const args = process.argv.slice(2);
    
    // If no arguments, show help and list buckets
    if (args.length === 0) {
        console.log('📸 Camera Images S3 Upload Utility\n');
        console.log('Usage:');
        console.log('  node upload-camera-images-to-s3.js <bucket-name> <developerId> <projectId> <cameraId> <image-path>');
        console.log('\nExample:');
        console.log('  node upload-camera-images-to-s3.js camera-pictures dev1 proj1 cam1 ./test-images/20240101120000.jpg');
        console.log('\nTo upload multiple images:');
        console.log('  node upload-camera-images-to-s3.js camera-pictures dev1 proj1 cam1 ./test-images/*.jpg');
        console.log('\nTo list available buckets:');
        console.log('  node upload-camera-images-to-s3.js list\n');
        
        try {
            const buckets = await listBuckets();
            if (buckets.length > 0) {
                console.log('💡 Tip: Use one of these bucket names in your .env file:');
                console.log(`   S3_CAMERA_BUCKET_NAME=${buckets[0]}\n`);
            }
        } catch (error) {
            // Already logged
        }
        return;
    }
    
    // List buckets command
    if (args[0] === 'list') {
        await listBuckets();
        return;
    }
    
    // Upload command
    if (args.length < 5) {
        console.error('✗ Error: Missing arguments');
        console.error('Usage: node upload-camera-images-to-s3.js <bucket-name> <developerId> <projectId> <cameraId> <image-path>');
        process.exit(1);
    }
    
    const [bucketName, developerId, projectId, cameraId, ...imagePaths] = args;
    
    console.log('📸 Uploading camera images to S3\n');
    console.log(`Bucket: ${bucketName}`);
    console.log(`Path: upload/${developerId}/${projectId}/${cameraId}/large/\n`);
    
    // Expand glob patterns if needed (basic support)
    const filesToUpload = [];
    for (const imagePath of imagePaths) {
        if (imagePath.includes('*')) {
            // Simple glob expansion (for Windows, use glob package for better support)
            const dir = path.dirname(imagePath);
            const pattern = path.basename(imagePath);
            if (fs.existsSync(dir)) {
                const files = fs.readdirSync(dir);
                const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
                files.filter(f => regex.test(f)).forEach(f => {
                    filesToUpload.push(path.join(dir, f));
                });
            }
        } else {
            filesToUpload.push(imagePath);
        }
    }
    
    if (filesToUpload.length === 0) {
        console.error('✗ No files found to upload');
        process.exit(1);
    }
    
    console.log(`Found ${filesToUpload.length} file(s) to upload:\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const imagePath of filesToUpload) {
        try {
            await uploadImage(bucketName, developerId, projectId, cameraId, imagePath);
            successCount++;
        } catch (error) {
            failCount++;
        }
    }
    
    console.log(`\n✅ Upload complete: ${successCount} succeeded, ${failCount} failed`);
    
    // List uploaded files
    if (successCount > 0) {
        console.log('\n📋 Verifying uploads...');
        const prefix = `upload/${developerId}/${projectId}/${cameraId}/large/`;
        const objects = await listObjects(bucketName, prefix);
        console.log(`Found ${objects.length} object(s) in bucket:\n`);
        objects.slice(0, 10).forEach(obj => {
            console.log(`  - ${obj.Key} (${(obj.Size / 1024).toFixed(2)} KB)`);
        });
        if (objects.length > 10) {
            console.log(`  ... and ${objects.length - 10} more`);
        }
    }
}

// Run the script
main().catch(error => {
    console.error('\n✗ Fatal error:', error.message);
    process.exit(1);
});

