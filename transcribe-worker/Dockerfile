FROM node:20-alpine
WORKDIR /app
COPY transcribe-worker/package.json ./package.json
RUN npm ci --omit=dev
COPY shared ./shared
COPY transcribe-worker/src ./src
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "src/index.js"]
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node src/healthcheck.js || exit 1


