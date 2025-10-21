FROM node:20-alpine

# Install FFmpeg for video processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Create tmp directory for processing
RUN mkdir -p /tmp

# Expose port (if needed for health checks)
EXPOSE 3004

# Start the worker
CMD ["node", "src/worker.js"]
