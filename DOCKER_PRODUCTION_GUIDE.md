# 🚀 Checkmate Docker Production Deployment Guide

Deploy Checkmate in production using Docker in under 5 minutes!

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ installed
- 2GB+ available RAM
- Port 80 available (or configure alternative)

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/mkumar-hive/Checkmate.git
cd Checkmate
```

### 2. Configure Environment Variables

Create `.env.production` file with your settings:

```bash
cat > .env.production << 'EOF'
# === REQUIRED CONFIGURATION ===

# Application URLs (Change these for your domain)
CLIENT_HOST=http://localhost
CLIENT_API_URL=http://localhost/api/v1

# Security (MUST CHANGE IN PRODUCTION!)
JWT_SECRET=your-very-secure-random-string-min-32-chars
TOKEN_TTL=24h

# MongoDB Password (MUST CHANGE!)
MONGO_ROOT_PASSWORD=your-secure-mongodb-password
MONGO_APP_PASSWORD=your-secure-app-password

# === OPTIONAL CONFIGURATION ===

# Email Notifications (Leave empty to disable)
SYSTEM_EMAIL_HOST=smtp.gmail.com
SYSTEM_EMAIL_PORT=587
SYSTEM_EMAIL_USER=your-email@gmail.com
SYSTEM_EMAIL_PASSWORD=your-app-password
SYSTEM_EMAIL_FROM=noreply@yourdomain.com

# Logging
LOG_LEVEL=info

# Advanced Settings (Usually no need to change)
PORT=52345
MONGO_ROOT_USER=checkmate_admin
CAPTURE_API_SECRET=your-capture-secret
USE_SSL=false
SSL_CERT_PATH=
SSL_KEY_PATH=
EOF
```

**⚠️ IMPORTANT: Change these values in production:**
- `JWT_SECRET` - Use a cryptographically secure random string
- `MONGO_ROOT_PASSWORD` - Strong password for MongoDB root
- `MONGO_APP_PASSWORD` - Strong password for application database user
- `CLIENT_HOST` - Your actual domain (e.g., https://monitoring.yourdomain.com)
- `CLIENT_API_URL` - Your API URL (e.g., https://monitoring.yourdomain.com/api/v1)

### 3. Deploy with Docker Compose

```bash
# Build and start all services
docker compose --env-file .env.production -f production-docker-compose.yml up -d

# Check status
docker compose --env-file .env.production -f production-docker-compose.yml ps
```

### 4. Access Your Application

- **Web Interface**: http://localhost (or your configured domain)
- **API Endpoint**: http://localhost:52345/api/v1/health

First time setup:
1. Navigate to the web interface
2. Create your admin account
3. Start adding monitors!

## 🔧 Common Operations

### View Logs
```bash
# All services
docker compose --env-file .env.production -f production-docker-compose.yml logs -f

# Specific service
docker compose --env-file .env.production -f production-docker-compose.yml logs -f server
```

### Stop Services
```bash
docker compose --env-file .env.production -f production-docker-compose.yml down
```

### Restart Services
```bash
docker compose --env-file .env.production -f production-docker-compose.yml restart
```

### Update Application
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker compose --env-file .env.production -f production-docker-compose.yml build
docker compose --env-file .env.production -f production-docker-compose.yml up -d
```

### Backup MongoDB
```bash
# Create backup
docker exec checkmate-mongodb mongosh --eval "db.adminCommand('fsync', {lock: true})"
docker exec checkmate-mongodb mongodump --out /data/backup
docker exec checkmate-mongodb mongosh --eval "db.adminCommand('fsync', {unlock: true})"

# Copy backup to host
docker cp checkmate-mongodb:/data/backup ./mongodb-backup-$(date +%Y%m%d)
```

## 🔒 Production Security Checklist

- [ ] Changed default JWT_SECRET
- [ ] Changed MongoDB passwords
- [ ] Configured proper domain in CLIENT_HOST
- [ ] Set up SSL/TLS certificates (for HTTPS)
- [ ] Configured firewall rules
- [ ] Set up regular backups
- [ ] Configured email for notifications
- [ ] Reviewed and adjusted rate limiting

## 📊 Resource Requirements

### Minimum (Small deployment, <100 monitors)
- CPU: 2 cores
- RAM: 2GB
- Storage: 10GB

### Recommended (Medium deployment, <1000 monitors)
- CPU: 4 cores
- RAM: 4GB
- Storage: 20GB

### Large Scale (1000+ monitors)
- CPU: 8+ cores
- RAM: 8GB+
- Storage: 50GB+
- Consider MongoDB replica set
- Consider Redis cluster

## 🚨 Troubleshooting

### Services not starting?
```bash
# Check logs
docker compose --env-file .env.production -f production-docker-compose.yml logs

# Check individual service
docker logs checkmate-server
```

### MongoDB authentication issues?
```bash
# Reset MongoDB (WARNING: Deletes all data!)
docker compose --env-file .env.production -f production-docker-compose.yml down -v
docker compose --env-file .env.production -f production-docker-compose.yml up -d
```

### Port conflicts?
Edit `production-docker-compose.yml` and change the port mappings:
```yaml
ports:
  - "8080:80"  # Change 8080 to your desired port
```

### Session timeout issues?
Adjust `TOKEN_TTL` in `.env.production`:
- `1h` = 1 hour
- `24h` = 24 hours
- `7d` = 7 days

## 🔄 Using with Reverse Proxy (Nginx/Traefik)

If running behind a reverse proxy:

1. Remove port 80/443 mapping from client service in `production-docker-compose.yml`
2. Configure your reverse proxy to forward to the container
3. Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name monitoring.yourdomain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api {
        proxy_pass http://localhost:52345;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 📝 Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CLIENT_HOST` | Yes | - | Public URL for web interface |
| `CLIENT_API_URL` | Yes | - | API endpoint URL |
| `JWT_SECRET` | Yes | - | Secret key for JWT tokens (min 32 chars) |
| `TOKEN_TTL` | No | 24h | Session duration (e.g., 1h, 24h, 7d) |
| `MONGO_ROOT_PASSWORD` | Yes | - | MongoDB root password |
| `MONGO_APP_PASSWORD` | Yes | - | MongoDB app user password |
| `SYSTEM_EMAIL_HOST` | No | - | SMTP server hostname |
| `SYSTEM_EMAIL_PORT` | No | - | SMTP server port |
| `SYSTEM_EMAIL_USER` | No | - | SMTP username |
| `SYSTEM_EMAIL_PASSWORD` | No | - | SMTP password |
| `LOG_LEVEL` | No | info | Logging level (debug/info/warn/error) |

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/mkumar-hive/Checkmate/issues)
- **Original Project**: [Bluewave Labs Checkmate](https://github.com/bluewave-labs/Checkmate)

## 📜 License

This project is licensed under the same license as the original Checkmate project by Bluewave Labs.

---

**Made with ❤️ by the Checkmate Community**