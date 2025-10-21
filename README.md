# Video Transcoding Microservices Platform

A scalable microservices architecture for video transcoding with CPU-intensive processing, built for cloud deployment and horizontal scaling.

## Architecture Overview

This platform consists of 4 microservices:

1. **Web Service** (Port 3000) - React frontend served by Nginx
2. **Auth Service** (Port 3001) - Authentication and JWT validation
3. **Transcoding Service** (Port 3002) - CPU-intensive video processing
4. **Upload Service** (Port 3003) - File upload and AssemblyAI processing

## Services Communication

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Web       │    │   Auth      │    │ Transcoding │    │   Upload    │
│  Service    │◄──►│  Service    │◄──►│  Service    │◄──►│  Service    │
│  (React)    │    │ (Cognito)   │    │  (FFmpeg)   │    │(AssemblyAI) │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │                   │
       └───────────────────┼───────────────────┼───────────────────┘
                           │                   │
                    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
                    │     S3      │    │  DynamoDB   │    │     SQS     │
                    │  (Storage)  │    │ (Database)  │    │  (Queues)   │
                    └─────────────┘    └─────────────┘    └─────────────┘
                                                                    │
                                                           ┌─────────────┐
                                                           │SQS Worker   │
                                                           │(Background) │
                                                           └─────────────┘
```

## SQS Communication

This application uses AWS SQS for inter-service communication and background processing:

### SQS Queues
- **transcoding-queue**: Handles video transcoding jobs
- **upload-queue**: Processes file uploads and metadata  
- **storage-queue**: Manages AssemblyAI processing
- **notifications-queue**: Handles system notifications

### Queue URLs
```
https://sqs.ap-southeast-2.amazonaws.com/901444280953/transcoding-queue
https://sqs.ap-southeast-2.amazonaws.com/901444280953/upload-queue
https://sqs.ap-southeast-2.amazonaws.com/901444280953/storage-queue
https://sqs.ap-southeast-2.amazonaws.com/901444280953/notifications-queue
```

### Testing SQS
```bash
# Test SQS communication
node scripts/test-sqs.js
```

## Quick Start

### Prerequisites

- Docker and Docker Compose
- AWS Account with S3, DynamoDB, and Cognito
- AssemblyAI API Key

### 1. Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your AWS credentials and configuration
nano .env
```

### 2. Start Services

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### 3. Access the Application

- **Frontend**: http://localhost:3000
- **API Gateway**: http://localhost:80
- **Auth Service**: http://localhost:3001
- **Transcoding Service**: http://localhost:3002
- **Upload Service**: http://localhost:3003

## Service Details

### Web Service (Frontend)
- **Technology**: React + Nginx
- **Port**: 3000
- **Features**: User interface, video management, real-time status
- **Docker**: Multi-stage build with Nginx serving static files

### Auth Service
- **Technology**: Node.js + Express + Cognito
- **Port**: 3001
- **Features**: User authentication, JWT validation, MFA support
- **Endpoints**: `/api/auth/*`

### Transcoding Service
- **Technology**: Node.js + Express + FFmpeg
- **Port**: 3002
- **Features**: CPU-intensive video processing, auto-scaling support
- **Endpoints**: `/api/transcoding/*`
- **Resource Requirements**: High CPU, 2GB+ RAM

### Upload Service
- **Technology**: Node.js + Express + AssemblyAI
- **Port**: 3003
- **Features**: File upload, S3 presigned URLs, AI processing
- **Endpoints**: `/api/storage/*`, `/api/videos/*`

## Development

### Local Development

```bash
# Install dependencies for each service
cd auth-service && npm install
cd transcoding-service && npm install
cd upload-service && npm install
cd web && npm install

# Start services individually
npm run dev  # in each service directory
```

### Testing

```bash
# Test individual services
curl http://localhost:3001/health  # Auth service
curl http://localhost:3002/health  # Transcoding service
curl http://localhost:3003/health  # Upload service
```

## Production Deployment

### AWS ECS Deployment

1. **Build and push Docker images**:
```bash
# Build images
docker build -t your-registry/auth-service ./auth-service
docker build -t your-registry/transcoding-service ./transcoding-service
docker build -t your-registry/upload-service ./upload-service
docker build -t your-registry/web-service ./web

# Push to ECR
aws ecr get-login-password --region ap-southeast-2 | docker login --username AWS --password-stdin your-account.dkr.ecr.ap-southeast-2.amazonaws.com
docker push your-registry/auth-service
docker push your-registry/transcoding-service
docker push your-registry/upload-service
docker push your-registry/web-service
```

2. **Deploy with ECS**:
- Create ECS cluster
- Create task definitions for each service
- Configure auto-scaling groups
- Set up Application Load Balancer

### Auto-Scaling Configuration

The transcoding service is designed for horizontal scaling:

- **CPU-based scaling**: Scale based on CPU utilization
- **Queue-based scaling**: Scale based on job queue length
- **Custom metrics**: Scale based on custom CloudWatch metrics

## Monitoring and Logging

### Health Checks

Each service provides health check endpoints:
- `/health` - Service health status
- `/api/transcoding/metrics` - CPU and memory metrics

### Logging

- **Application logs**: Structured JSON logging
- **Access logs**: Nginx access logs
- **Error logs**: Service-specific error tracking

## Security

### Authentication Flow

1. User logs in via Auth Service
2. Auth Service validates with Cognito
3. JWT token issued and validated across services
4. Service-to-service communication uses internal authentication

### Network Security

- **Internal communication**: Services communicate via private network
- **External access**: Only through load balancer
- **HTTPS**: SSL/TLS termination at load balancer

## Performance Optimization

### Caching

- **Static assets**: CloudFront CDN for web assets
- **API responses**: Redis caching for frequently accessed data
- **Video metadata**: S3 metadata caching

### Database Optimization

- **DynamoDB**: Optimized for video metadata queries
- **S3**: Intelligent tiering for video storage
- **Connection pooling**: Optimized database connections

## Troubleshooting

### Common Issues

1. **Service not starting**: Check environment variables and AWS credentials
2. **Transcoding failures**: Verify FFmpeg installation and CPU resources
3. **Authentication errors**: Check Cognito configuration
4. **Upload failures**: Verify S3 permissions and bucket configuration

### Debug Commands

```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs [service-name]

# Execute commands in running container
docker-compose exec [service-name] sh

# Check resource usage
docker stats
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details
