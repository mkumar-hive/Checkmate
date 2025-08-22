# Production Deployment Guide for Checkmate

This guide will help you deploy Checkmate in a production environment using Docker.

## Prerequisites

- Docker Engine 20.10+ and Docker Compose 2.0+
- A server with at least 2GB RAM and 10GB disk space
- Domain name (optional, for HTTPS)
- SSL certificates (optional, for HTTPS)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/bluewave-labs/checkmate.git
cd checkmate
```

### 2. Configure Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.production.example .env.production
```

Edit `.env.production` with your values:

```bash
# REQUIRED: Change these values
JWT_SECRET=your-very-secure-random-string-at-least-32-chars
MONGO_ROOT_PASSWORD=your-secure-mongodb-password

# Configure your domain
CLIENT_HOST=https://checkmate.yourdomain.com
CLIENT_API_URL=https://checkmate.yourdomain.com/api/v1

# Optional: Email configuration for notifications
SYSTEM_EMAIL_HOST=smtp.gmail.com
SYSTEM_EMAIL_PORT=587
SYSTEM_EMAIL_USER=your-email@gmail.com
SYSTEM_EMAIL_PASSWORD=your-app-password
```

### 3. Build and Start Services

```bash
# Load environment variables
export $(cat .env.production | grep -v '^#' | xargs)

# Build images
docker compose -f production-docker-compose.yml build

# Start services
docker compose -f production-docker-compose.yml up -d
```

### 4. Verify Deployment

Check if all services are running:

```bash
docker compose -f production-docker-compose.yml ps
```

Access your Checkmate instance:
- Frontend: http://localhost (or your domain)
- API: http://localhost:52345/api/v1

## Configuration Options

### SSL/HTTPS Setup

1. **Using Let's Encrypt (Recommended)**

```bash
# Install certbot
sudo apt-get install certbot

# Generate certificates
sudo certbot certonly --standalone -d checkmate.yourdomain.com

# Copy certificates to the SSL directory
mkdir -p ssl/certs
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/certs/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/certs/key.pem
```

2. **Update nginx configuration**

Uncomment the SSL server block in `docker/production/nginx/conf.d/default.conf`

3. **Update environment**

```bash
USE_SSL=true
CLIENT_HOST=https://checkmate.yourdomain.com
```

### Email Notifications

Configure email settings in `.env.production`:

```bash
SYSTEM_EMAIL_HOST=smtp.gmail.com
SYSTEM_EMAIL_PORT=587
SYSTEM_EMAIL_USER=notifications@yourdomain.com
SYSTEM_EMAIL_PASSWORD=your-app-specific-password
SYSTEM_EMAIL_FROM=Checkmate <noreply@yourdomain.com>
```

For Gmail:
1. Enable 2-factor authentication
2. Generate an app-specific password
3. Use the app password in the configuration

### Database Backup

Create automated backups:

```bash
# Manual backup
docker exec checkmate-mongodb mongodump --db checkmate --out /backup
docker cp checkmate-mongodb:/backup ./backups/

# Automated backup script (add to cron)
#!/bin/bash
BACKUP_DIR="/path/to/backups"
DATE=$(date +%Y%m%d_%H%M%S)
docker exec checkmate-mongodb mongodump --db checkmate --archive=/backup/checkmate_$DATE.gz --gzip
docker cp checkmate-mongodb:/backup/checkmate_$DATE.gz $BACKUP_DIR/
# Keep only last 7 days of backups
find $BACKUP_DIR -name "checkmate_*.gz" -mtime +7 -delete
```

## Production Best Practices

### 1. Security

- **Change default passwords**: Always use strong, unique passwords
- **Use HTTPS**: Enable SSL/TLS for production
- **Firewall rules**: Only expose necessary ports (80, 443)
- **Regular updates**: Keep Docker images and dependencies updated

### 2. Monitoring

Monitor your Checkmate instance:

```bash
# View logs
docker compose -f production-docker-compose.yml logs -f

# Monitor resource usage
docker stats

# Check service health
docker compose -f production-docker-compose.yml exec server curl http://localhost:52345/health
```

### 3. Scaling

For high availability:

```yaml
# In production-docker-compose.yml, scale the server:
server:
  deploy:
    replicas: 3
```

### 4. Resource Limits

Add resource constraints in production:

```yaml
services:
  server:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Maintenance

### Updating Checkmate

```bash
# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose -f production-docker-compose.yml build
docker compose -f production-docker-compose.yml up -d
```

### Cleaning Up

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes (CAREFUL: This removes data!)
docker volume prune

# View disk usage
docker system df
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose -f production-docker-compose.yml logs [service-name]

# Restart specific service
docker compose -f production-docker-compose.yml restart [service-name]
```

### Database Connection Issues

```bash
# Check MongoDB status
docker exec checkmate-mongodb mongosh --eval "db.adminCommand('ping')"

# Check Redis status
docker exec checkmate-redis redis-cli ping
```

### High Memory Usage

```bash
# Check memory usage
docker stats

# Restart services to clear memory
docker compose -f production-docker-compose.yml restart
```

### Reset Admin Password

```bash
# Connect to MongoDB
docker exec -it checkmate-mongodb mongosh checkmate

# In MongoDB shell
db.users.updateOne(
  { email: "admin@example.com" },
  { $set: { password: null } }
)
```

## Advanced Configuration

### Using External MongoDB

Update `DB_CONNECTION_STRING` in `.env.production`:

```bash
DB_CONNECTION_STRING=mongodb://username:password@external-host:27017/checkmate?authSource=admin
```

### Custom Health Checks

Add to `docker/production/server.Dockerfile`:

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:52345/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"
```

### Rate Limiting

Configure in `docker/production/nginx/nginx.conf`:

```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
limit_req zone=api burst=20 nodelay;
```

## Support

- GitHub Issues: https://github.com/bluewave-labs/checkmate/issues
- Documentation: https://docs.checkmate.so
- Discord: https://discord.gg/NAb6H3UTjK

---

## Quick Reference Commands

```bash
# Start services
docker compose -f production-docker-compose.yml up -d

# Stop services
docker compose -f production-docker-compose.yml down

# View logs
docker compose -f production-docker-compose.yml logs -f

# Restart service
docker compose -f production-docker-compose.yml restart [service]

# Execute command in container
docker exec -it checkmate-server sh

# Backup database
docker exec checkmate-mongodb mongodump --db checkmate --archive=/backup/checkmate.gz --gzip

# Restore database
docker exec -i checkmate-mongodb mongorestore --archive --gzip < checkmate.gz
```