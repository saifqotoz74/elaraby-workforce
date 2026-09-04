# Production Dockerfile for Elaraby Connect Backend
FROM node:18-alpine

# Set node environment
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Install dependencies (only production)
COPY package*.json ./
RUN npm ci --only=production

# Copy application files
COPY . .

# Create persistent storage directories and assign permissions
RUN mkdir -p /app/data /app/uploads && chown -R node:node /app

# Switch to unprivileged user for security
USER node

# Expose API port
EXPOSE 3000

# Docker healthcheck using the native /api/health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => { if (r.statusCode !== 200) process.exit(1); })"

CMD ["node", "server.js"]
