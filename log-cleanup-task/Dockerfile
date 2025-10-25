FROM node:18-alpine

# Install AWS CLI for additional AWS operations
RUN apk add --no-cache aws-cli

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Run the cleanup script
CMD ["npm", "start"]

