# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install necessary system dependencies for Prisma
RUN apk add --no-cache \
    openssl \
    libc6-compat \
    && rm -rf /var/cache/apk/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --only=production && npm cache clean --force

# Development stage
FROM base AS dev
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies)
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Development command
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

# Set NODE_ENV
ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 gamecast

# Copy all dependencies from builder (includes Prisma client)
COPY --from=builder --chown=gamecast:nodejs /app/node_modules ./node_modules

# Copy built application and source files for Swagger JSDoc
COPY --from=builder --chown=gamecast:nodejs /app/dist ./dist
COPY --from=builder --chown=gamecast:nodejs /app/src ./src
COPY --from=builder --chown=gamecast:nodejs /app/package*.json ./
COPY --from=builder --chown=gamecast:nodejs /app/prisma ./prisma
COPY --from=builder --chown=gamecast:nodejs /app/tsconfig.json ./

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs && chown gamecast:nodejs /app/logs && chmod 755 /app/logs
RUN mkdir -p /app/uploads && chown gamecast:nodejs /app/uploads && chmod 755 /app/uploads
RUN mkdir -p /app/public && chown gamecast:nodejs /app/public && chmod 755 /app/public

# Switch to non-root user
USER gamecast

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
               const options = { host: 'localhost', port: 3000, path: '/health', timeout: 2000 }; \
               const req = http.request(options, (res) => { \
                 if (res.statusCode === 200) process.exit(0); \
                 else process.exit(1); \
               }); \
               req.on('error', () => process.exit(1)); \
               req.end();"

# Start the application
CMD ["node", "dist/index.js"]
