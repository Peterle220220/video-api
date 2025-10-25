/**
 * MAINTENANCE SCHEDULED TASK
 * 
 * This task runs daily (triggered by EventBridge) to perform system maintenance:
 * - Clean up old temporary files from S3
 * - Check system health and log status
 * - Update metadata for stale records
 * - Monitor resource utilization
 * 
 * Part of Advanced Container Orchestration (ECS Scheduled Tasks)
 */

const AWS = require('aws-sdk');

// Configure AWS SDK
const region = process.env.AWS_REGION || 'ap-southeast-2';
AWS.config.update({ region });

const s3 = new AWS.S3();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();
const ecs = new AWS.ECS();

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'cab432-a2-n12122882';
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'cab432-a2-n12122882-metadata';
const CLUSTER_NAME = process.env.ECS_CLUSTER_NAME || 'n12122882-a3-cluster';

// Temporary files older than 7 days will be deleted
const TEMP_FILE_RETENTION_DAYS = 7;

/**
 * Main maintenance function
 */
async function runMaintenance() {
  console.log('=================================================');
  console.log('🔧 STARTING DAILY MAINTENANCE TASK');
  console.log('=================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Region: ${region}`);
  console.log(`S3 Bucket: ${BUCKET_NAME}`);
  console.log(`DynamoDB Table: ${TABLE_NAME}`);
  console.log(`ECS Cluster: ${CLUSTER_NAME}`);
  console.log('');

  const results = {
    tempFilesDeleted: 0,
    metadataUpdated: 0,
    errors: []
  };

  try {
    // 1. Clean up temporary files from S3
    console.log('📁 TASK 1: Cleaning up temporary files from S3...');
    results.tempFilesDeleted = await cleanupTemporaryFiles();
    console.log(`✅ Deleted ${results.tempFilesDeleted} temporary files\n`);

    // 2. Check and update stale metadata in DynamoDB
    console.log('📊 TASK 2: Checking DynamoDB metadata...');
    results.metadataUpdated = await updateStaleMetadata();
    console.log(`✅ Updated ${results.metadataUpdated} stale records\n`);

    // 3. Check ECS cluster health
    console.log('🏥 TASK 3: Checking ECS cluster health...');
    await checkClusterHealth();
    console.log('✅ Cluster health check completed\n');

    // 4. Log resource utilization metrics
    console.log('📈 TASK 4: Logging resource utilization...');
    await logResourceMetrics();
    console.log('✅ Metrics logged successfully\n');

    // 5. Verify S3 bucket structure
    console.log('🗂️  TASK 5: Verifying S3 bucket structure...');
    await verifyBucketStructure();
    console.log('✅ Bucket structure verified\n');

  } catch (error) {
    console.error('❌ ERROR during maintenance:', error);
    results.errors.push(error.message);
  }

  // Summary
  console.log('=================================================');
  console.log('📋 MAINTENANCE SUMMARY');
  console.log('=================================================');
  console.log(`Temporary files deleted: ${results.tempFilesDeleted}`);
  console.log(`Metadata records updated: ${results.metadataUpdated}`);
  console.log(`Errors encountered: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    results.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
  }
  
  console.log('\n✨ MAINTENANCE TASK COMPLETED');
  console.log('=================================================\n');

  // Exit with appropriate code
  process.exit(results.errors.length > 0 ? 1 : 0);
}

/**
 * Clean up temporary files older than retention period
 */
async function cleanupTemporaryFiles() {
  let deletedCount = 0;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - TEMP_FILE_RETENTION_DAYS);

  try {
    // List objects in the temp folder
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: 'temp/'
    };

    const listedObjects = await s3.listObjectsV2(listParams).promise();

    if (!listedObjects.Contents || listedObjects.Contents.length === 0) {
      console.log('  No temporary files found');
      return 0;
    }

    // Filter files older than cutoff date
    const oldFiles = listedObjects.Contents.filter(obj => {
      return obj.LastModified < cutoffDate;
    });

    console.log(`  Found ${oldFiles.length} temporary files older than ${TEMP_FILE_RETENTION_DAYS} days`);

    // Delete old files
    for (const file of oldFiles) {
      try {
        await s3.deleteObject({
          Bucket: BUCKET_NAME,
          Key: file.Key
        }).promise();
        
        deletedCount++;
        console.log(`  🗑️  Deleted: ${file.Key}`);
      } catch (error) {
        console.error(`  ⚠️  Failed to delete ${file.Key}:`, error.message);
      }
    }

  } catch (error) {
    if (error.code === 'NoSuchBucket') {
      console.log('  ℹ️  Bucket does not exist or is not accessible');
    } else {
      console.error('  Error listing temporary files:', error.message);
    }
  }

  return deletedCount;
}

/**
 * Update stale metadata in DynamoDB
 */
async function updateStaleMetadata() {
  let updatedCount = 0;

  try {
    // Scan for records with processing status that are older than 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);

    const scanParams = {
      TableName: TABLE_NAME,
      FilterExpression: '#status = :processing AND #timestamp < :cutoff',
      ExpressionAttributeNames: {
        '#status': 'status',
        '#timestamp': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':processing': 'processing',
        ':cutoff': oneHourAgo
      }
    };

    const result = await dynamodb.scan(scanParams).promise();

    if (!result.Items || result.Items.length === 0) {
      console.log('  No stale records found');
      return 0;
    }

    console.log(`  Found ${result.Items.length} stale processing records`);

    // Update stale records to 'error' status
    for (const item of result.Items) {
      try {
        await dynamodb.update({
          TableName: TABLE_NAME,
          Key: { videoId: item.videoId },
          UpdateExpression: 'SET #status = :error, #updatedAt = :now, #errorMsg = :msg',
          ExpressionAttributeNames: {
            '#status': 'status',
            '#updatedAt': 'updatedAt',
            '#errorMsg': 'errorMessage'
          },
          ExpressionAttributeValues: {
            ':error': 'error',
            ':now': Date.now(),
            ':msg': 'Marked as error by maintenance task due to prolonged processing'
          }
        }).promise();

        updatedCount++;
        console.log(`  📝 Updated stale record: ${item.videoId}`);
      } catch (error) {
        console.error(`  ⚠️  Failed to update ${item.videoId}:`, error.message);
      }
    }

  } catch (error) {
    if (error.code === 'ResourceNotFoundException') {
      console.log('  ℹ️  Table does not exist or is not accessible');
    } else {
      console.error('  Error scanning metadata:', error.message);
    }
  }

  return updatedCount;
}

/**
 * Check ECS cluster health
 */
async function checkClusterHealth() {
  try {
    const clusterData = await ecs.describeClusters({
      clusters: [CLUSTER_NAME]
    }).promise();

    if (clusterData.clusters.length === 0) {
      console.log('  ⚠️  Cluster not found');
      return;
    }

    const cluster = clusterData.clusters[0];
    console.log(`  Cluster: ${cluster.clusterName}`);
    console.log(`  Status: ${cluster.status}`);
    console.log(`  Running tasks: ${cluster.runningTasksCount}`);
    console.log(`  Pending tasks: ${cluster.pendingTasksCount}`);
    console.log(`  Active services: ${cluster.activeServicesCount}`);

    // List services
    const servicesData = await ecs.listServices({
      cluster: CLUSTER_NAME
    }).promise();

    console.log(`  Total services: ${servicesData.serviceArns.length}`);

  } catch (error) {
    console.error('  Error checking cluster health:', error.message);
  }
}

/**
 * Log resource utilization metrics to CloudWatch
 */
async function logResourceMetrics() {
  try {
    const metrics = [];

    // Create custom metrics
    metrics.push({
      MetricName: 'MaintenanceTaskRun',
      Value: 1,
      Unit: 'Count',
      Timestamp: new Date()
    });

    // Put metrics to CloudWatch
    await cloudwatch.putMetricData({
      Namespace: 'CAB432/Maintenance',
      MetricData: metrics
    }).promise();

    console.log('  Custom metrics logged to CloudWatch');

  } catch (error) {
    console.error('  Error logging metrics:', error.message);
  }
}

/**
 * Verify S3 bucket structure
 */
async function verifyBucketStructure() {
  try {
    const requiredFolders = ['videos/', 'transcoded/', 'thumbnails/', 'temp/'];
    
    console.log('  Checking for required folders:');
    
    for (const folder of requiredFolders) {
      try {
        await s3.headObject({
          Bucket: BUCKET_NAME,
          Key: folder
        }).promise();
        console.log(`  ✓ ${folder}`);
      } catch (error) {
        if (error.code === 'NotFound') {
          // Folder doesn't exist, create a placeholder
          console.log(`  ⚠️  ${folder} not found, creating...`);
          await s3.putObject({
            Bucket: BUCKET_NAME,
            Key: folder,
            Body: ''
          }).promise();
          console.log(`  ✓ ${folder} created`);
        }
      }
    }

  } catch (error) {
    console.error('  Error verifying bucket structure:', error.message);
  }
}

// Run the maintenance task
runMaintenance();

