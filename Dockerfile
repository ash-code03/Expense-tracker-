# syntax=docker/dockerfile:1

# Step 1: Base image using official Node.js 20 LTS on Alpine Linux
FROM node:20-alpine

# Set environment to production
ENV NODE_ENV=production

# Set working directory inside container
WORKDIR /usr/src/app

# Install dependencies before copying application code for Docker layer caching
COPY package*.json ./

# Install only production dependencies cleanly
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy application source files
COPY . .

# Set proper permissions for the non-root node user
RUN chown -R node:node /usr/src/app

# Switch to non-root user for security best practices
USER node

# Expose backend application port
EXPOSE 3000

# Start server using Node
CMD ["node", "server.js"]
