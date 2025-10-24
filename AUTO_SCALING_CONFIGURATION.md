# 📊 Auto Scaling Configuration for ECS Services

## 🎯 Overview

This document describes the auto scaling configuration for the ECS services in the n12122882-cab432-a3 project.

## ✅ Services with Auto Scaling

### 1. SQS Worker Service

- **Service Name:** `n12122882-cab432-a3-sqs-worker-service`
- **Resource ID:** `service/n12122882-a3-cluster/n12122882-cab432-a3-sqs-worker-service`
- **Min Capacity:** 1 task
- **Max Capacity:** 3 tasks
- **Scaling Policy:** CPU-based auto scaling
- **Target CPU Utilization:** 70%
- **Scale Out Cooldown:** 60 seconds (1 minute)
- **Scale In Cooldown:** 300 seconds (5 minutes)

### 2. Transcoding Service

- **Service Name:** `n12122882-cab432-a3-transcoding-service`
- **Resource ID:** `service/n12122882-a3-cluster/n12122882-cab432-a3-transcoding-service`
- **Min Capacity:** 1 task
- **Max Capacity:** 5 tasks
- **Scaling Policy:** CPU-based auto scaling
- **Target CPU Utilization:** 75%
- **Scale Out Cooldown:** 60 seconds (1 minute)
- **Scale In Cooldown:** 300 seconds (5 minutes)

## ⚙️ Auto Scaling Configuration Details

### Scaling Metrics

- **Metric Type:** `ECSServiceAverageCPUUtilization`
- **Policy Type:** `TargetTrackingScaling`
- **Namespace:** `ecs`

### Scaling Behavior

- **Scale Out:** When CPU utilization exceeds target value
- **Scale In:** When CPU utilization drops below target value
- **Cooldown Periods:** Prevent rapid scaling actions

## 🔍 Monitoring Auto Scaling

### Check Current Scaling Targets

```bash
aws application-autoscaling describe-scalable-targets --service-namespace ecs --query 'ScalableTargets[?contains(ResourceId, `n12122882`)].{ResourceId:ResourceId,MinCapacity:MinCapacity,MaxCapacity:MaxCapacity,ScalableDimension:ScalableDimension}' --output table
```

### Check Scaling Policies

```bash
aws application-autoscaling describe-scaling-policies --service-namespace ecs --query 'ScalingPolicies[?contains(ResourceId, `n12122882`)].{PolicyName:PolicyName,ResourceId:ResourceId,PolicyType:PolicyType,TargetValue:TargetTrackingScalingPolicyConfiguration.TargetValue}' --output table
```

### Check Service Status

```bash
aws ecs describe-services --cluster n12122882-a3-cluster --services n12122882-cab432-a3-sqs-worker-service n12122882-cab432-a3-transcoding-service --query 'services[*].{ServiceName:serviceName,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount}' --output table
```

## 📈 Expected Behavior

### SQS Worker Service

- **Normal Load:** 1 task running
- **High Load:** Scales up to 3 tasks when CPU > 70%
- **Low Load:** Scales down to 1 task when CPU < 70%

### Transcoding Service

- **Normal Load:** 1 task running
- **High Load:** Scales up to 5 tasks when CPU > 75%
- **Low Load:** Scales down to 1 task when CPU < 75%

## 🔧 Services Without Auto Scaling

The following services do NOT have auto scaling configured:

- **Web Service:** `n12122882-cab432-a3-web-service`
- **Auth Service:** `n12122882-cab432-a3-auth-service`
- **Upload Service:** `n12122882-cab432-a3-upload-service`

These services run with a fixed desired count of 1 task.

## 🎯 Why These Services Have Auto Scaling

### SQS Worker Service

- **Purpose:** Background task processing
- **Workload:** Variable based on queue depth
- **Scaling Need:** CPU-intensive operations that benefit from horizontal scaling

### Transcoding Service

- **Purpose:** Video transcoding operations
- **Workload:** CPU-intensive video processing
- **Scaling Need:** High CPU usage during transcoding operations

## 📊 Auto Scaling Benefits

1. **Cost Optimization:** Automatically scales down during low usage
2. **Performance:** Scales up during high demand
3. **Reliability:** Maintains service availability during traffic spikes
4. **Resource Efficiency:** Optimizes CPU utilization

## 🔍 Troubleshooting Auto Scaling

### Check CloudWatch Alarms

```bash
aws cloudwatch describe-alarms --alarm-names-prefix "AWS/ECS"
```

### Check Scaling History

```bash
aws application-autoscaling describe-scaling-activities --service-namespace ecs --resource-id "service/n12122882-a3-cluster/n12122882-cab432-a3-sqs-worker-service"
```

### Check ECS Service Events

```bash
aws ecs describe-services --cluster n12122882-a3-cluster --services n12122882-cab432-a3-sqs-worker-service --query 'services[0].events[0:10]' --output table
```

## 📋 Summary

The auto scaling configuration provides:

- **2 services** with auto scaling enabled
- **CPU-based scaling** with configurable thresholds
- **Automatic scaling** between min and max capacity
- **Cooldown periods** to prevent rapid scaling
- **Monitoring capabilities** through AWS CLI and Console

This setup ensures optimal resource utilization and cost management for CPU-intensive services.
