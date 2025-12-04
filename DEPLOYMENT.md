# Deployment Guide

## Prerequisites

1. Docker and Docker Compose installed
2. Environment variables configured
3. Redis for data persistence

## Setup

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your actual values:

- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Discord application client ID
- `DISCORD_GUILD_ID`: Your Discord server ID
- `PARTICIPANT_ROLE_ID`: Role ID for participants
- `MANAGER_USER_ID`: Discord user ID of the bot administrator
- `REDIS_HOST`: Redis hostname (default: `redis` for Docker Compose)
- `REDIS_PORT`: Redis port (default: `6379`)

### 2. Production Deployment

#### Using Docker Compose (Recommended)

```bash
# Pull latest images and start
docker compose pull
docker compose up -d

# View logs
docker compose logs -f bot

# Stop the service
docker compose down
```

#### Manual Docker Run

```bash
# Start Redis
docker run -d \
  --name ratmas-redis \
  --restart unless-stopped \
  -v ratmas_redis_data:/data \
  redis:7-alpine redis-server --appendonly yes

# Run bot
docker run -d \
  --name ratmas-bot \
  --restart unless-stopped \
  --env-file .env \
  --link ratmas-redis:redis \
  ghcr.io/andrewgari/ratmas-bot:latest
```

## Data Management

### Database Persistence

Redis data is persisted to disk using AOF (Append-Only File):

- **Docker Compose**: Named volume `redis-data`
- **Manual deployment**: Docker volume or bind mount to `/data`

### Backup Database

```bash
# Trigger Redis save
docker compose exec redis redis-cli BGSAVE

# Copy Redis data to host
docker cp ratmas-redis:/data/appendonly.aof ./backup-$(date +%Y%m%d).aof
docker cp ratmas-redis:/data/dump.rdb ./backup-$(date +%Y%m%d).rdb
```

### Restore Database

```bash
# Stop containers
docker compose down

# Replace Redis data files
docker run --rm -v ratmas-script_redis-data:/data -v $(pwd):/backup alpine \
  sh -c "cp /backup/backup-YYYYMMDD.aof /data/appendonly.aof && \
         cp /backup/backup-YYYYMMDD.rdb /data/dump.rdb"

# Start containers
docker compose up -d
```

## Monitoring

### Health Checks

Redis includes built-in health checks:

```bash
# Check Redis health
docker compose exec redis redis-cli ping

# Check container status
docker compose ps
```

### Logs

```bash
# Follow bot logs
docker compose logs -f bot

# Follow Redis logs
docker compose logs -f redis

# View recent logs
docker compose logs --tail=50 bot
```

## Updates

### Automatic Updates (CI/CD)

The CI/CD pipeline automatically builds and pushes new images when:

- Code is pushed to `main` branch
- New releases are tagged

The self-hosted runner automatically deploys updates on push to main.

### Manual Updates

```bash
# Pull latest image
docker compose pull

# Recreate containers with new image
docker compose up -d --force-recreate
```

## Troubleshooting

### Container Won't Start

1. Check environment variables:

   ```bash
   docker compose config
   ```

2. Verify Discord token is valid
3. Check container logs:
   ```bash
   docker compose logs bot
   ```

### Redis Connection Issues

1. Verify Redis is running:

   ```bash
   docker compose ps redis
   docker compose exec redis redis-cli ping
   ```

2. Check Redis logs:
   ```bash
   docker compose logs redis
   ```

3. Verify network connectivity:
   ```bash
   docker compose exec bot ping redis
   ```

### Performance Issues

Monitor resource usage:

```bash
docker stats ratmas-bot ratmas-redis
```

### Data Loss Prevention

Redis uses AOF (Append-Only File) persistence:
- Every write operation is logged
- Data survives container restarts
- Automatic backups on `/end-ratmas` command

## Security Considerations

1. **Environment Files**: Never commit `.env` files to version control
2. **Redis Security**: Redis is not exposed to the host network (internal Docker network only)
3. **Network**: Bot doesn't expose any ports by default
4. **Updates**: Keep base images updated via automated rebuilds
5. **Secrets**: Use GitHub Secrets for CI/CD deployment
