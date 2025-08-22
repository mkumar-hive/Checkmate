# Production Dockerfile for Checkmate Client
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    gcc \
    libc-dev \
    linux-headers

# Copy package files
COPY ./client/package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY ./client ./

# Build the application
ARG VITE_APP_API_BASE_URL
ARG VITE_APP_CLIENT_HOST
ENV VITE_APP_API_BASE_URL=${VITE_APP_API_BASE_URL}
ENV VITE_APP_CLIENT_HOST=${VITE_APP_CLIENT_HOST}

RUN npm run build

# Production stage - Nginx
FROM nginx:1.25-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Remove default nginx config
RUN rm -rf /etc/nginx/conf.d/default.conf

# Copy built files from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY ./docker/production/nginx/nginx.conf /etc/nginx/nginx.conf
COPY ./docker/production/nginx/conf.d/default.conf /etc/nginx/conf.d/default.conf

# Copy env.sh script for runtime environment variable injection
COPY ./client/env.sh /docker-entrypoint.d/env.sh
RUN chmod +x /docker-entrypoint.d/env.sh

# Create non-root user
RUN addgroup -g 1001 -S nginx-group && \
    adduser -S nginx-user -u 1001 -G nginx-group

# Set proper permissions
RUN chown -R nginx-user:nginx-group /usr/share/nginx/html && \
    chown -R nginx-user:nginx-group /var/cache/nginx && \
    chown -R nginx-user:nginx-group /var/log/nginx && \
    chown -R nginx-user:nginx-group /etc/nginx/conf.d && \
    touch /var/run/nginx.pid && \
    chown -R nginx-user:nginx-group /var/run/nginx.pid

# Switch to non-root user
USER nginx-user

# Expose ports
EXPOSE 80 443

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]