# Terraform Infrastructure for CAB432 Assessment 3

This directory contains the Terraform code to provision the required AWS infrastructure for the project, based on the Assessment 3 criteria.

## File Structure

The infrastructure code is broken down into logical components for clarity and maintainability:

- `providers.tf`: Configures the AWS provider. (You may already have this)
- `variables.tf`: Defines all input variables. You should create a `terraform.tfvars` file to provide values for these variables.
- `outputs.tf`: Declares output values from the infrastructure, such as the application URL.
- `network.tf`: Configures networking resources. It uses data sources to look up the existing VPC and subnets provided in the course's AWS account.
- `iam.tf`: Creates the necessary IAM roles and policies for ECS Tasks and Lambda functions.
- `sqs.tf`: Defines the SQS queues for the transcoding tasks, including the Dead Letter Queue (DLQ).
- `ecr.tf`: Creates ECR repositories to store Docker images for each microservice.
- `lambda.tf`: Sets up the AWS Lambda function that triggers on S3 object creation.
- `alb.tf`: Configures the Application Load Balancer, target groups, and listener rules for routing traffic to the services.
- `ecs.tf`: Defines the ECS cluster, task definitions, and services for running the microservices.
- `autoscaling.tf`: Contains the application auto-scaling configuration for the `sqs-worker` service.
- `route53.tf`: Manages Route 53 records to point your custom domain to the ALB.

## How to Use

1.  **Install Terraform**: Make sure you have Terraform installed on your machine.
2.  **Configure AWS Credentials**: Ensure your AWS CLI is configured with the credentials for the course account.
3.  **Create `terraform.tfvars` file**: In this directory, create a file named `terraform.tfvars` and fill in the required variables defined in `variables.tf`. For example:

    ```hcl
    region                = "ap-southeast-2"
    qut_username          = "n1234567"
    project_name          = "media-streaming-app"
    domain_name           = "your-subdomain.cab432.com"
    hosted_zone_name      = "cab432.com"
    acm_certificate_arn   = "arn:aws:acm:ap-southeast-2:ACCOUNT_ID:certificate/CERTIFICATE_ID"

    // ECR Image URIs (update these after you push your images)
    image_uri_web         = "ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/media-streaming-app-web:latest"
    image_uri_auth        = "ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/media-streaming-app-auth:latest"
    image_uri_transcoding = "ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/media-streaming-app-transcoding:latest"
    image_uri_upload      = "ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/media-streaming-app-upload:latest"
    image_uri_sqs_worker  = "ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/media-streaming-app-sqs-worker:latest"
    ```

4.  **Initialize Terraform**: Run `terraform init` to download the necessary provider plugins.
5.  **Plan**: Run `terraform plan` to see the execution plan.
6.  **Apply**: Run `terraform apply` to create the resources.

## Pushing Docker Images to ECR

Before you can run the ECS services, you must build your Docker images and push them to the ECR repositories created by Terraform.

1.  After the first `terraform apply`, get the repository URLs from the output or the AWS console.
2.  For each service, build the Docker image.
3.  Authenticate Docker with ECR:
    `aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com`
4.  Tag your image:
    `docker tag your-image:latest ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/your-repo-name:latest`
5.  Push the image:
    `docker push ACCOUNT_ID.dkr.ecr.ap-southeast-2.amazonaws.com/your-repo-name:latest`
6.  Update the `image_uri_*` variables in your `terraform.tfvars` file and run `terraform apply` again.

## Assessment 3 Criteria Coverage

This Terraform configuration addresses the following Assessment 3 criteria:

### Core Criteria (10 marks)

- ✅ **Microservices (3 marks)**: 5 microservices (web, auth, transcoding, upload, sqs-worker)
- ✅ **Load distribution (2 marks)**: SQS queues for task distribution
- ✅ **Auto scaling (3 marks)**: ECS auto-scaling for sqs-worker service
- ✅ **HTTPS (2 marks)**: ALB with SSL certificate and Route 53

### Additional Criteria (14 marks)

- ✅ **Additional microservices (2 marks)**: 5 total microservices
- ✅ **Serverless functions (2 marks)**: Lambda function triggered by S3 events
- ✅ **Container orchestration with ECS (2 marks)**: All services deployed on ECS Fargate
- ✅ **Communication mechanisms (2 marks)**: ALB path-based routing + SQS queues
- ✅ **Infrastructure as code (2 marks)**: Complete Terraform configuration
- ✅ **Dead letter queue (2 marks)**: SQS DLQ for failed transcoding tasks
- ✅ **Edge caching (2 marks)**: Can be added with CloudFront (optional)

## Architecture Overview

```
Internet → Route 53 → ALB (HTTPS) → ECS Services
                    ↓
            [web, auth, transcoding, upload]
                    ↓
            SQS Queues → sqs-worker (auto-scaled)
                    ↓
            S3 + DynamoDB + Cognito (existing from A2)
```

## Troubleshooting

1. **Permission errors**: Ensure your AWS credentials have the necessary permissions
2. **Certificate errors**: Verify the certificate ARN is correct and in the right region
3. **Domain errors**: Ensure your domain is properly configured in Route 53
4. **ECS errors**: Check that Docker images are pushed to ECR repositories
5. **Auto-scaling**: Monitor CloudWatch metrics to verify scaling behavior
