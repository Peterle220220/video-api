#!/bin/bash

# =============================================================================
# DEMO SCRIPT: Advanced Container Orchestration Features
# =============================================================================
# This script demonstrates the 3 advanced ECS orchestration features:
# 1. Service Discovery
# 2. Rolling Updates with Failure Detection  
# 3. Scheduled Tasks
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="video-transcoding"
QUT_USERNAME="your-username"  # Replace with your QUT username
REGION="ap-southeast-2"
CLUSTER_NAME="${PROJECT_NAME}-${QUT_USERNAME}-cluster"

echo -e "${BLUE}🚀 Advanced Container Orchestration Demo${NC}"
echo -e "${BLUE}===========================================${NC}"

# =============================================================================
# 1. SERVICE DISCOVERY DEMONSTRATION
# =============================================================================

echo -e "\n${GREEN}📡 1. SERVICE DISCOVERY DEMONSTRATION${NC}"
echo -e "${GREEN}=====================================${NC}"

echo -e "\n${YELLOW}Step 1.1: Check Service Discovery Namespace${NC}"
echo "Navigate to AWS Console → ECS → Clusters → $CLUSTER_NAME"
echo "Click on 'Service discovery' tab"
echo "You should see:"
echo "  - Namespace: ${PROJECT_NAME}-${QUT_USERNAME}.local"
echo "  - Services: web, auth, transcoding, upload"

echo -e "\n${YELLOW}Step 1.2: Verify Service Registration${NC}"
aws ecs list-services --cluster $CLUSTER_NAME --region $REGION

echo -e "\n${YELLOW}Step 1.3: Test Service Discovery (from within ECS task)${NC}"
echo "Run this command inside a running ECS task:"
echo "  nslookup auth.${PROJECT_NAME}-${QUT_USERNAME}.local"
echo "  nslookup transcoding.${PROJECT_NAME}-${QUT_USERNAME}.local"

# =============================================================================
# 2. ROLLING UPDATES WITH FAILURE DETECTION
# =============================================================================

echo -e "\n${GREEN}🔄 2. ROLLING UPDATES WITH FAILURE DETECTION${NC}"
echo -e "${GREEN}============================================${NC}"

echo -e "\n${YELLOW}Step 2.1: Check Current Service Configuration${NC}"
echo "Navigate to AWS Console → ECS → Clusters → $CLUSTER_NAME → Services"
echo "Click on 'web-service' → 'Configuration' tab"
echo "Verify these settings:"
echo "  - Deployment configuration:"
echo "    • Maximum percent: 200%"
echo "    • Minimum healthy percent: 50%"
echo "  - Deployment circuit breaker: ENABLED"
echo "  - Rollback on failure: ENABLED"

echo -e "\n${YELLOW}Step 2.2: Trigger Rolling Update${NC}"
echo "To demonstrate rolling update:"
echo "1. Go to ECS Console → Services → web-service"
echo "2. Click 'Update service'"
echo "3. Change task definition to a new version"
echo "4. Click 'Update'"
echo "5. Watch the deployment process in 'Deployments' tab"

echo -e "\n${YELLOW}Step 2.3: Monitor Deployment${NC}"
echo "Watch for:"
echo "  - New tasks starting (PENDING → RUNNING)"
echo "  - Old tasks stopping (RUNNING → STOPPING → STOPPED)"
echo "  - Health checks passing"
echo "  - Load balancer target health"

echo -e "\n${YELLOW}Step 2.4: Test Failure Detection${NC}"
echo "To test circuit breaker:"
echo "1. Deploy a task definition with invalid image"
echo "2. Watch deployment fail"
echo "3. Verify automatic rollback occurs"

# =============================================================================
# 3. SCHEDULED TASKS DEMONSTRATION
# =============================================================================

echo -e "\n${GREEN}⏰ 3. SCHEDULED TASKS DEMONSTRATION${NC}"
echo -e "${GREEN}===================================${NC}"

echo -e "\n${YELLOW}Step 3.1: Check CloudWatch Event Rules${NC}"
echo "Navigate to AWS Console → CloudWatch → Events → Rules"
echo "Look for these rules:"
echo "  - ${PROJECT_NAME}-${QUT_USERNAME}-maintenance-schedule (daily)"
echo "  - ${PROJECT_NAME}-${QUT_USERNAME}-log-cleanup (weekly)"

echo -e "\n${YELLOW}Step 3.2: Verify Scheduled Task Definitions${NC}"
echo "Navigate to AWS Console → ECS → Task Definitions"
echo "Look for:"
echo "  - ${PROJECT_NAME}-${QUT_USERNAME}-maintenance"
echo "  - ${PROJECT_NAME}-${QUT_USERNAME}-log-cleanup"

echo -e "\n${YELLOW}Step 3.3: Test Scheduled Task Execution${NC}"
echo "To manually trigger a scheduled task:"
echo "1. Go to CloudWatch → Events → Rules"
echo "2. Select the maintenance rule"
echo "3. Click 'Actions' → 'Test rule'"
echo "4. Watch ECS Console for new task execution"

echo -e "\n${YELLOW}Step 3.4: Monitor Task Execution${NC}"
echo "Check CloudWatch Logs:"
echo "  - /ecs/${PROJECT_NAME}-maintenance"
echo "  - /ecs/${PROJECT_NAME}-log-cleanup"

# =============================================================================
# 4. AWS CONSOLE NAVIGATION GUIDE
# =============================================================================

echo -e "\n${GREEN}🗺️  4. AWS CONSOLE NAVIGATION GUIDE${NC}"
echo -e "${GREEN}===================================${NC}"

echo -e "\n${BLUE}Service Discovery:${NC}"
echo "1. ECS Console → Clusters → $CLUSTER_NAME"
echo "2. Click 'Service discovery' tab"
echo "3. View namespace and registered services"

echo -e "\n${BLUE}Rolling Updates:${NC}"
echo "1. ECS Console → Clusters → $CLUSTER_NAME → Services"
echo "2. Select any service (e.g., web-service)"
echo "3. View 'Configuration' tab for deployment settings"
echo "4. Check 'Deployments' tab for update history"

echo -e "\n${BLUE}Scheduled Tasks:${NC}"
echo "1. CloudWatch Console → Events → Rules"
echo "2. View scheduled rules and their targets"
echo "3. ECS Console → Task Definitions (for maintenance tasks)"
echo "4. CloudWatch Logs for execution logs"

# =============================================================================
# 5. COMMAND LINE VERIFICATION
# =============================================================================

echo -e "\n${GREEN}💻 5. COMMAND LINE VERIFICATION${NC}"
echo -e "${GREEN}===================================${NC}"

echo -e "\n${YELLOW}Check ECS Cluster:${NC}"
aws ecs describe-clusters --clusters $CLUSTER_NAME --region $REGION

echo -e "\n${YELLOW}List Services:${NC}"
aws ecs list-services --cluster $CLUSTER_NAME --region $REGION

echo -e "\n${YELLOW}Check Service Discovery:${NC}"
aws servicediscovery list-namespaces --region $REGION

echo -e "\n${YELLOW}List Scheduled Rules:${NC}"
aws events list-rules --region $REGION

echo -e "\n${YELLOW}Check Task Definitions:${NC}"
aws ecs list-task-definitions --family-prefix $PROJECT_NAME --region $REGION

# =============================================================================
# 6. DEMONSTRATION CHECKLIST
# =============================================================================

echo -e "\n${GREEN}✅ DEMONSTRATION CHECKLIST${NC}"
echo -e "${GREEN}===========================${NC}"

echo -e "\n${YELLOW}Service Discovery (2 points):${NC}"
echo "□ Private DNS namespace created"
echo "□ Services registered in namespace"
echo "□ Service-to-service communication via DNS names"
echo "□ Health checks configured"

echo -e "\n${YELLOW}Rolling Updates (2 points):${NC}"
echo "□ Deployment configuration with max/min percentages"
echo "□ Circuit breaker enabled with rollback"
echo "□ Health check grace period configured"
echo "□ Successful rolling update demonstration"

echo -e "\n${YELLOW}Scheduled Tasks (2 points):${NC}"
echo "□ CloudWatch Event Rules created"
echo "□ ECS Task Definitions for maintenance"
echo "□ Scheduled execution (daily/weekly)"
echo "□ Task execution logs in CloudWatch"

echo -e "\n${GREEN}🎉 Total: 6 points for Advanced Container Orchestration!${NC}"

echo -e "\n${BLUE}📝 Video Recording Tips:${NC}"
echo "1. Show AWS Console navigation clearly"
echo "2. Demonstrate each feature working"
echo "3. For rolling updates, show the deployment process"
echo "4. For scheduled tasks, show the CloudWatch logs"
echo "5. Explain how each feature improves the architecture"

echo -e "\n${GREEN}Demo completed! 🚀${NC}"
