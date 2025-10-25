# Multi-stage build for React app
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Set build-time environment variables for React
# React will bake these into the JS bundle during build
ENV REACT_APP_AUTH_SERVICE_URL=https://n12122882.cab432.com/api/auth
ENV REACT_APP_TRANSCODING_SERVICE_URL=https://n12122882.cab432.com/api/transcoding
ENV REACT_APP_UPLOAD_SERVICE_URL=https://n12122882.cab432.com/api/storage

# Build the app
RUN npm run build

# Production stage with Nginx
FROM nginx:alpine

# Copy built app from builder stage
COPY --from=builder /app/build /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 3000

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
