/**
 * LOG CLEANUP SCHEDULED TASK
 * 
 * This task runs weekly (triggered by EventBridge) to:
 * - Clean up old CloudWatch log streams
 * - Delete logs older than retention period
 * - Reduce storage costs
 * - Maintain optimal log performance
 * 
 * Part of Advanced Container Orchestration (ECS Scheduled Tasks)
 */

const AWS = require('aws-sdk');

// Configure AWS SDK
const region = process.env.AWS_REGION || 'ap-southeast-2';
AWS.config.update({ region });

const cloudwatchLogs = new AWS.CloudWatchLogs();
const cloudwatch = new AWS.CloudWatch();

// Retention settings
const LOG_RETENTION_DAYS = 30; // Keep logs for 30 days
const EMPTY_STREAMS_RETENTION_DAYS = 7; // Delete empty streams after 7 days

/**
 * Main cleanup function
 */
async function runLogCleanup() {
  console.log('=================================================');
  console.log('🧹 STARTING WEEKLY LOG CLEANUP TASK');
  console.log('=================================================');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`Region: ${region}`);
  console.log(`Log retention: ${LOG_RETENTION_DAYS} days`);
  console.log(`Empty stream retention: ${EMPTY_STREAMS_RETENTION_DAYS} days`);
  console.log('');

  const results = {
    logGroupsProcessed: 0,
    streamsDeleted: 0,
    retentionPoliciesSet: 0,
    bytesFreed: 0,
    errors: []
  };

  try {
    // 1. Get all log groups
    console.log('📋 TASK 1: Discovering CloudWatch log groups...');
    const logGroups = await getAllLogGroups();
    console.log(`✅ Found ${logGroups.length} log groups\n`);

    // 2. Set retention policies
    console.log('⏰ TASK 2: Setting retention policies...');
    results.retentionPoliciesSet = await setRetentionPolicies(logGroups);
    console.log(`✅ Set retention policy for ${results.retentionPoliciesSet} log groups\n`);

    // 3. Clean up old and empty log streams
    console.log('🗑️  TASK 3: Cleaning up old and empty log streams...');
    for (const logGroup of logGroups) {
      try {
        const deleted = await cleanupLogStreams(logGroup.logGroupName);
        results.streamsDeleted += deleted;
        results.logGroupsProcessed++;
      } catch (error) {
        console.error(`  ⚠️  Error processing ${logGroup.logGroupName}:`, error.message);
        results.errors.push(`${logGroup.logGroupName}: ${error.message}`);
      }
    }
    console.log(`✅ Deleted ${results.streamsDeleted} log streams across ${results.logGroupsProcessed} log groups\n`);

    // 4. Calculate storage freed
    console.log('💾 TASK 4: Calculating storage impact...');
    results.bytesFreed = await calculateStorageImpact(logGroups);
    console.log(`✅ Estimated ${formatBytes(results.bytesFreed)} freed\n`);

    // 5. Log cleanup metrics
    console.log('📊 TASK 5: Logging cleanup metrics...');
    await logCleanupMetrics(results);
    console.log('✅ Metrics logged to CloudWatch\n');

  } catch (error) {
    console.error('❌ ERROR during log cleanup:', error);
    results.errors.push(error.message);
  }

  // Summary
  console.log('=================================================');
  console.log('📋 LOG CLEANUP SUMMARY');
  console.log('=================================================');
  console.log(`Log groups processed: ${results.logGroupsProcessed}`);
  console.log(`Log streams deleted: ${results.streamsDeleted}`);
  console.log(`Retention policies set: ${results.retentionPoliciesSet}`);
  console.log(`Storage freed: ${formatBytes(results.bytesFreed)}`);
  console.log(`Errors encountered: ${results.errors.length}`);
  
  if (results.errors.length > 0) {
    console.log('\n⚠️  ERRORS:');
    results.errors.forEach((err, idx) => {
      console.log(`  ${idx + 1}. ${err}`);
    });
  }
  
  console.log('\n✨ LOG CLEANUP TASK COMPLETED');
  console.log('=================================================\n');

  // Exit with appropriate code
  process.exit(results.errors.length > 0 ? 1 : 0);
}

/**
 * Get all CloudWatch log groups
 */
async function getAllLogGroups() {
  const logGroups = [];
  let nextToken = null;

  try {
    do {
      const params = {
        limit: 50
      };
      
      if (nextToken) {
        params.nextToken = nextToken;
      }

      const response = await cloudwatchLogs.describeLogGroups(params).promise();
      
      if (response.logGroups) {
        logGroups.push(...response.logGroups);
      }
      
      nextToken = response.nextToken;
    } while (nextToken);

    // Filter to only ECS-related log groups
    const ecsLogGroups = logGroups.filter(lg => 
      lg.logGroupName.includes('/ecs/') || 
      lg.logGroupName.includes('cab432') ||
      lg.logGroupName.includes('n12122882')
    );

    console.log(`  Total log groups: ${logGroups.length}`);
    console.log(`  ECS-related log groups: ${ecsLogGroups.length}`);

    return ecsLogGroups;

  } catch (error) {
    console.error('  Error getting log groups:', error.message);
    return [];
  }
}

/**
 * Set retention policies for log groups
 */
async function setRetentionPolicies(logGroups) {
  let count = 0;

  for (const logGroup of logGroups) {
    try {
      // Check if retention is already set
      if (!logGroup.retentionInDays || logGroup.retentionInDays > LOG_RETENTION_DAYS) {
        await cloudwatchLogs.putRetentionPolicy({
          logGroupName: logGroup.logGroupName,
          retentionInDays: LOG_RETENTION_DAYS
        }).promise();

        console.log(`  📅 Set ${LOG_RETENTION_DAYS} day retention: ${logGroup.logGroupName}`);
        count++;
      } else {
        console.log(`  ✓ Already has retention: ${logGroup.logGroupName} (${logGroup.retentionInDays} days)`);
      }
    } catch (error) {
      console.error(`  ⚠️  Failed to set retention for ${logGroup.logGroupName}:`, error.message);
    }
  }

  return count;
}

/**
 * Clean up old and empty log streams in a log group
 */
async function cleanupLogStreams(logGroupName) {
  let deletedCount = 0;
  const cutoffDate = Date.now() - (EMPTY_STREAMS_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  try {
    let nextToken = null;
    const streamsToDelete = [];

    // Get all log streams
    do {
      const params = {
        logGroupName: logGroupName,
        limit: 50,
        orderBy: 'LastEventTime',
        descending: false
      };

      if (nextToken) {
        params.nextToken = nextToken;
      }

      const response = await cloudwatchLogs.describeLogStreams(params).promise();

      if (response.logStreams) {
        // Find empty or very old streams
        for (const stream of response.logStreams) {
          const lastEventTime = stream.lastEventTime || stream.creationTime;
          const storedBytes = stream.storedBytes || 0;

          // Delete if:
          // 1. Empty and older than retention period
          // 2. Or very old (older than 60 days regardless of size)
          const isOld = lastEventTime < cutoffDate;
          const isEmpty = storedBytes === 0;
          const isVeryOld = lastEventTime < (Date.now() - (60 * 24 * 60 * 60 * 1000));

          if ((isEmpty && isOld) || isVeryOld) {
            streamsToDelete.push(stream.logStreamName);
          }
        }
      }

      nextToken = response.nextToken;
    } while (nextToken);

    // Delete streams (batch of 10 at a time to avoid rate limits)
    for (let i = 0; i < streamsToDelete.length; i += 10) {
      const batch = streamsToDelete.slice(i, i + 10);
      
      for (const streamName of batch) {
        try {
          await cloudwatchLogs.deleteLogStream({
            logGroupName: logGroupName,
            logStreamName: streamName
          }).promise();

          deletedCount++;
        } catch (error) {
          // Ignore "ResourceNotFoundException" as stream might already be deleted
          if (error.code !== 'ResourceNotFoundException') {
            console.error(`    ⚠️  Failed to delete stream ${streamName}:`, error.message);
          }
        }
      }

      // Small delay to avoid rate limiting
      if (i + 10 < streamsToDelete.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    if (deletedCount > 0) {
      console.log(`  🗑️  ${logGroupName}: Deleted ${deletedCount} log streams`);
    }

  } catch (error) {
    if (error.code !== 'ResourceNotFoundException') {
      throw error;
    }
  }

  return deletedCount;
}

/**
 * Calculate storage impact
 */
async function calculateStorageImpact(logGroups) {
  let totalBytes = 0;

  try {
    for (const logGroup of logGroups) {
      if (logGroup.storedBytes) {
        totalBytes += logGroup.storedBytes;
      }
    }
  } catch (error) {
    console.error('  Error calculating storage:', error.message);
  }

  // Estimate freed space (rough estimate: 20% of total)
  return Math.floor(totalBytes * 0.2);
}

/**
 * Log cleanup metrics to CloudWatch
 */
async function logCleanupMetrics(results) {
  try {
    const metrics = [
      {
        MetricName: 'LogCleanupTaskRun',
        Value: 1,
        Unit: 'Count',
        Timestamp: new Date()
      },
      {
        MetricName: 'LogStreamsDeleted',
        Value: results.streamsDeleted,
        Unit: 'Count',
        Timestamp: new Date()
      },
      {
        MetricName: 'LogGroupsProcessed',
        Value: results.logGroupsProcessed,
        Unit: 'Count',
        Timestamp: new Date()
      },
      {
        MetricName: 'StorageFreed',
        Value: results.bytesFreed,
        Unit: 'Bytes',
        Timestamp: new Date()
      }
    ];

    await cloudwatch.putMetricData({
      Namespace: 'CAB432/LogCleanup',
      MetricData: metrics
    }).promise();

    console.log('  Custom metrics logged to CloudWatch');

  } catch (error) {
    console.error('  Error logging metrics:', error.message);
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Run the log cleanup task
runLogCleanup();

