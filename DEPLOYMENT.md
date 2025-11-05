# Deployment Guide

## Prerequisites

1. Docker and Docker Compose installed
2. Environment variables configured
3. Persistent data directory set up

## Setup

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

- `DISCORD_TOKEN`: Your Discord bot token
- `CLIENT_ID`: Discord application client ID  
- `GUILD_ID`: Your Discord server ID
- `DATA_PATH`: Host path for persistent data (default: `./data`)

### 2. Create Data Directory

```bash
mkdir -p ./data
chmod 755 ./data
```

### 3. Production Deployment

#### Using Docker Compose (Recommended)

```bash
# Pull latest image and start
docker-compose pull
docker-compose up -d

# View logs
docker-compose logs -f ratmas-bot

# Stop the service
docker-compose down
```

#### Manual Docker Run

```bash
# Create volume
docker volume create ratmas_data

# Run container
docker run -d \
  --name ratmas-bot \
  --restart unless-stopped \
  --env-file .env \
  -v ratmas_data:/app/data \
  ghcr.io/andrewgari/ratmas-bot:latest
```

## Volume Management

### Database Persistence

The SQLite database is stored in `/app/data/ratmas.sqlite` inside the container and persisted via:

- **Docker Compose**: Named volume `ratmas_data` mapped to host path
- **Manual deployment**: Docker volume or bind mount

### Backup Database

```bash
# With docker-compose
docker-compose exec ratmas-bot cp /app/data/ratmas.sqlite /app/data/backup-$(date +%Y%m%d).sqlite

# Copy to host
docker cp ratmas-bot:/app/data/ratmas.sqlite ./backup-$(date +%Y%m%d).sqlite
```

### Restore Database

```bash
# Stop container
docker-compose down

# Replace database file
cp backup-YYYYMMDD.sqlite ./data/ratmas.sqlite

# Start container
docker-compose up -d
```

## Monitoring

### Health Checks

The container includes health checks that verify the application is running:

```bash
# Check health status
docker-compose ps
docker inspect ratmas-bot --format='{{.State.Health.Status}}'
```

### Logs

```bash
# Follow logs
docker-compose logs -f ratmas-bot

# View recent logs
docker-compose logs --tail=50 ratmas-bot
```

## Updates

### Automatic Updates (CI/CD)

The CI/CD pipeline automatically builds and pushes new images when:
- Code is pushed to `main` branch
- New releases are tagged

### Manual Updates

```bash
# Pull latest image
docker-compose pull

# Recreate container with new image
docker-compose up -d --force-recreate
```

## Troubleshooting

### Container Won't Start

1. Check environment variables:
   ```bash
   docker-compose config
   ```

2. Verify Discord token is valid
3. Check container logs:
   ```bash
   docker-compose logs ratmas-bot
   ```

### Database Issues

1. Verify data directory permissions:
   ```bash
   ls -la ./data/
   ```

2. Check database file exists and is writable:
   ```bash
   docker-compose exec ratmas-bot ls -la /app/data/
   ```

### Performance Issues

Monitor resource usage:
```bash
docker stats ratmas-bot
```

The container is limited to:
- Memory: 512MB (limit), 256MB (reservation)
- CPU: 0.5 cores (limit), 0.25 cores (reservation)

## Security Considerations

1. **Environment Files**: Never commit `.env` files to version control
2. **File Permissions**: Ensure data directory has appropriate permissions
3. **Network**: Container doesn't expose any ports by default
4. **Updates**: Keep base images updated via automated rebuilds