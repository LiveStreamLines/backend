// Quick script to check S3 buckets and connection
const { S3Client, ListBucketsCommand } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
    endpoint: 'https://s3.ap-southeast-1.idrivee2.com',
    region: 'ap-southeast-1',
    credentials: {
        accessKeyId: 'fMZXDwBL2hElR6rEzgCW',
        secretAccessKey: 'gXrfsUVEDttGQBv3GIfjZvokZ4qrAFsOUywiN4TD'
    },
    forcePathStyle: true,
    signatureVersion: 'v4'
});

async function listBuckets() {
    try {
        console.log('Connecting to S3...');
        const command = new ListBucketsCommand({});
        const response = await s3Client.send(command);
        
        if (response.Buckets && response.Buckets.length > 0) {
            console.log('\n✓ Available buckets:');
            response.Buckets.forEach((bucket, index) => {
                console.log(`  ${index + 1}. ${bucket.Name} (created: ${bucket.CreationDate})`);
            });
            console.log('\nYou can use one of these bucket names by setting:');
            console.log(`  export S3_BUCKET_NAME=your-bucket-name\n`);
        } else {
            console.log('\n✗ No buckets found. You need to create a bucket first.');
            console.log('  Option 1: Create bucket "attachments" in your S3 console');
            console.log('  Option 2: Use an existing bucket by setting S3_BUCKET_NAME\n');
        }
    } catch (error) {
        console.error('\n✗ Error connecting to S3:');
        console.error(`  ${error.message}\n`);
        console.error('Please verify:');
        console.error('  1. Your S3 credentials are correct');
        console.error('  2. Your server can reach: s3.ap-southeast-1.idrivee2.com');
        console.error('  3. Your S3 service is accessible\n');
    }
}

listBuckets();

