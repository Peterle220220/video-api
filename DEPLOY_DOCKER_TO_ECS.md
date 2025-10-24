# 🚀 Deploy Docker Images to ECS Services

## 📋 Overview

This document explains how to build, push Docker images to ECR, and deploy them to ECS services.

## 🔧 Prerequisites

- Docker installed and running
- AWS CLI configured with proper permissions
- ECR repositories already created via Terraform

## 📊 Current ECS Setup

- **Cluster:** `n12122882-a3-cluster`
- **Services:**
  - `n12122882-cab432-a3-web-service`
  - `n12122882-cab432-a3-auth-service`
  - `n12122882-cab432-a3-upload-service`
  - `n12122882-cab432-a3-transcoding-service`
  - `n12122882-cab432-a3-sqs-worker-service`

## 🏗️ Step 1: Build and Push Docker Images to ECR

### 1.1 Login to ECR

```bash
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com
```

### 1.2 Build and Push Web Service

```bash
cd /Volumes/hieuvivas/au-project/web
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-web:latest .
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-web:latest
```

### 1.3 Build and Push Auth Service

```bash
cd /Volumes/hieuvivas/au-project/auth-service
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-auth-service:latest .
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-auth-service:latest
```

### 1.4 Build and Push Upload Service

```bash
cd /Volumes/hieuvivas/au-project/upload-service
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-upload-service:latest .
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-upload-service:latest
```

### 1.5 Build and Push Transcoding Service

```bash
cd /Volumes/hieuvivas/au-project/transcoding-service
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-transcoding-service:latest .
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-transcoding-service:latest
```

### 1.6 Build and Push SQS Worker

```bash
cd /Volumes/hieuvivas/au-project/sqs-worker
docker build -t 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-sqs-worker:latest .
docker push 901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-sqs-worker:latest
```

## 🚀 Step 2: Deploy New Images to ECS Services

### 2.1 Force Deploy All Services

```bash
# Deploy Web Service
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-web-service --force-new-deployment

# Deploy Auth Service
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-auth-service --force-new-deployment

# Deploy Upload Service
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-upload-service --force-new-deployment

# Deploy Transcoding Service
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-transcoding-service --force-new-deployment

# Deploy SQS Worker Service
aws ecs update-service --cluster n12122882-a3-cluster --service n12122882-cab432-a3-sqs-worker-service --force-new-deployment
```

## 📊 Step 3: Monitor Deployment Status

### 3.1 Check All Services Status

```bash
aws ecs describe-services --cluster n12122882-a3-cluster --services n12122882-cab432-a3-web-service n12122882-cab432-a3-auth-service n12122882-cab432-a3-upload-service n12122882-cab432-a3-transcoding-service n12122882-cab432-a3-sqs-worker-service --query 'services[*].{ServiceName:serviceName,Status:status,RunningCount:runningCount,DesiredCount:desiredCount}' --output table
```

### 3.2 Check Specific Service Events

```bash
# Check Web Service events
aws ecs describe-services --cluster n12122882-a3-cluster --services n12122882-cab432-a3-web-service --query 'services[0].events[0:5]' --output table

# Check Auth Service events
aws ecs describe-services --cluster n12122882-a3-cluster --services n12122882-cab432-a3-auth-service --query 'services[0].events[0:5]' --output table
```

## 📝 Step 4: View Logs

### 4.1 View Logs via AWS CLI

```bash
# Get latest log stream for Web Service
aws logs describe-log-streams --log-group-name /ecs/n12122882-cab432-a3-web --order-by LastEventTime --descending --max-items 1

# Get latest log stream for Auth Service
aws logs describe-log-streams --log-group-name /ecs/n12122882-cab432-a3-auth --order-by LastEventTime --descending --max-items 1

# Get latest log stream for Upload Service
aws logs describe-log-streams --log-group-name /ecs/n12122882-cab432-a3-upload --order-by LastEventTime --descending --max-items 1
```

### 4.2 View Logs via AWS Console

1. Go to **CloudWatch** → **Logs** → **Log groups**
2. Find these log groups:
   - `/ecs/n12122882-cab432-a3-web`
   - `/ecs/n12122882-cab432-a3-auth`
   - `/ecs/n12122882-cab432-a3-upload`
   - `/ecs/n12122882-cab432-a3-transcoding`
   - `/ecs/n12122882-cab432-a3-sqs-worker`
3. Click on each log group → **Log streams** → Select latest stream

## 🔗 Step 5: Verify Application Access

### 5.1 Check Application URLs

- **Main Application:** `https://n12122882.cab432.com`
- **ALB DNS:** `n12122882-alb-terraform-360110495.ap-southeast-2.elb.amazonaws.com`

### 5.2 Test Application Endpoints

```bash
# Test main application
curl -I https://n12122882.cab432.com

# Test ALB directly
curl -I http://n12122882-alb-terraform-360110495.ap-southeast-2.elb.amazonaws.com
```

## ⏱️ Deployment Timeline

- **Build & Push:** 5-10 minutes per service
- **ECS Deployment:** 2-5 minutes per service
- **Total Time:** 15-30 minutes for all services

## 🔍 Troubleshooting

### Common Issues:

1. **Docker build fails:** Check Dockerfile and dependencies
2. **Push fails:** Verify ECR login and permissions
3. **ECS deployment fails:** Check logs in CloudWatch
4. **Health checks fail:** Verify application is running on correct port

### Debug Commands:

```bash
# Check ECR repositories
aws ecr describe-repositories --query 'repositories[?contains(repositoryName, `n12122882`)].{RepositoryName:repositoryName,RepositoryUri:repositoryUri}' --output table

# Check ECS cluster
aws ecs describe-clusters --clusters n12122882-a3-cluster

# Check running tasks
aws ecs list-tasks --cluster n12122882-a3-cluster
```

## 📋 Quick Reference

### ECR Repository URIs:

- Web: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-web:latest`
- Auth: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-auth-service:latest`
- Upload: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-upload-service:latest`
- Transcoding: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-transcoding-service:latest`
- SQS Worker: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n12122882-cab432-a3-sqs-worker:latest`

### Service Names:

- `n12122882-cab432-a3-web-service`
- `n12122882-cab432-a3-auth-service`
- `n12122882-cab432-a3-upload-service`
- `n12122882-cab432-a3-transcoding-service`
- `n12122882-cab432-a3-sqs-worker-service`

---

## 🎯 Summary

This process will:

1. Build your updated Docker images
2. Push them to ECR repositories
3. Force ECS services to pull and deploy new images
4. Monitor the deployment progress
5. Verify the application is working correctly

Follow these steps whenever you need to deploy updated code to your ECS services.
