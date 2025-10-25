/**
 * Lambda function to publish custom CloudWatch metrics for ECS auto-scaling
 * This function calculates SQS queue depth per running ECS task
 * and publishes it as a custom CloudWatch metric for more accurate scaling decisions.
 */

const { SQSClient, GetQueueAttributesCommand } = require('@aws-sdk/client-sqs');
const { ECSClient, DescribeServicesCommand } = require('@aws-sdk/client-ecs');
const { CloudWatchClient, PutMetricDataCommand } = require('@aws-sdk/client-cloudwatch');

// AWS SDK will automatically use the Lambda's region
const sqsClient = new SQSClient({});
const ecsClient = new ECSClient({});
const cloudwatchClient = new CloudWatchClient({});

/**
 * Get approximate number of messages in SQS queue
 */
async function getQueueDepth(queueUrl) {
  const command = new GetQueueAttributesCommand({
    QueueUrl: queueUrl,
    AttributeNames: ['ApproximateNumberOfMessages']
  });
  
  const response = await sqsClient.send(command);
  return parseInt(response.Attributes.ApproximateNumberOfMessages || '0');
}

/**
 * Get number of running tasks in ECS service
 */
async function getRunningTaskCount(clusterName, serviceName) {
  const command = new DescribeServicesCommand({
    cluster: clusterName,
    services: [serviceName]
  });
  
  const response = await ecsClient.send(command);
  if (response.services && response.services.length > 0) {
    return response.services[0].runningCount || 1; // Default to 1 to avoid division by zero
  }
  return 1;
}

/**
 * Publish custom metric to CloudWatch
 */
async function publishMetric(metricName, value, unit, dimensions) {
  const command = new PutMetricDataCommand({
    Namespace: 'CAB432/CustomMetrics',
    MetricData: [
      {
        MetricName: metricName,
        Value: value,
        Unit: unit,
        Timestamp: new Date(),
        Dimensions: dimensions
      }
    ]
  });
  
  await cloudwatchClient.send(command);
  console.log(`Published metric: ${metricName} = ${value} ${unit}`);
}

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('Starting custom metric calculation...');
  
  try {
    // Configuration from environment variables
    const queueUrl = process.env.TRANSCODING_QUEUE_URL;
    const clusterName = process.env.ECS_CLUSTER_NAME;
    const serviceName = process.env.ECS_SERVICE_NAME;
    
    if (!queueUrl || !clusterName || !serviceName) {
      throw new Error('Missing required environment variables');
    }
    
    console.log(`Queue URL: ${queueUrl}`);
    console.log(`Cluster: ${clusterName}`);
    console.log(`Service: ${serviceName}`);
    
    // Get queue depth
    const queueDepth = await getQueueDepth(queueUrl);
    console.log(`Queue depth: ${queueDepth} messages`);
    
    // Get running task count
    const runningTasks = await getRunningTaskCount(clusterName, serviceName);
    console.log(`Running tasks: ${runningTasks}`);
    
    // Calculate metric: messages per task
    const messagesPerTask = runningTasks > 0 ? queueDepth / runningTasks : queueDepth;
    console.log(`Messages per task: ${messagesPerTask}`);
    
    // Publish metrics to CloudWatch
    await publishMetric(
      'QueueDepth',
      queueDepth,
      'Count',
      [
        { Name: 'QueueName', Value: 'transcoding-queue' },
        { Name: 'ServiceName', Value: serviceName }
      ]
    );
    
    await publishMetric(
      'MessagesPerTask',
      messagesPerTask,
      'Count',
      [
        { Name: 'QueueName', Value: 'transcoding-queue' },
        { Name: 'ServiceName', Value: serviceName }
      ]
    );
    
    await publishMetric(
      'RunningTaskCount',
      runningTasks,
      'Count',
      [
        { Name: 'ServiceName', Value: serviceName }
      ]
    );
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        queueDepth,
        runningTasks,
        messagesPerTask,
        message: 'Custom metrics published successfully'
      })
    };
    
  } catch (error) {
    console.error('Error publishing custom metrics:', error);
    throw error;
  }
};

