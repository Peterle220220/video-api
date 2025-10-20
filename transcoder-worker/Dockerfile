FROM node:20-alpine as base
WORKDIR /app
COPY transcoder-worker/package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# Add ffmpeg
RUN apk add --no-cache ffmpeg

# Copy app and shared
COPY shared /shared
COPY transcoder-worker/src ./src

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node src/healthcheck.js || exit 1


