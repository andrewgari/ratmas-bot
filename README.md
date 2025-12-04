# Ratmas Bot

A Ratmas (rat-Christmas) Discord bot for managing Secret Santa-style gift exchanges.

## Features

- **Custom Assignments**: Participants choose who they send gifts to
- **Package Tracking**: Track how many packages each person is sending/receiving
- **Anonymous Messaging**: Two-way anonymous DM relay between gift givers and receivers
- **Season Management**: Start/end seasons with automatic data archiving
- **Redis Storage**: Fast, in-memory data persistence with automatic backups

## Quick Start

1. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Configure environment variables** (see Configuration section below)

3. **Run with Docker Compose:**
   ```bash
   docker compose up -d
   ```

4. **View logs:**
   ```bash
   docker compose logs -f bot
   ```

## Configuration

Required environment variables in `.env`:

- `DISCORD_TOKEN`: Your Discord bot token from the [Discord Developer Portal](https://discord.com/developers/applications)
- `DISCORD_CLIENT_ID`: Discord application client ID
- `DISCORD_GUILD_ID`: Your Discord server ID (enable Developer Mode in Discord to copy)
- `PARTICIPANT_ROLE_ID`: Role ID for participants (users with this role can join the exchange)
- `MANAGER_USER_ID`: Discord user ID of the bot administrator
- `REDIS_HOST`: Redis server hostname (default: `redis` for Docker Compose)
- `REDIS_PORT`: Redis server port (default: `6379`)

Slash commands register to the specified guild on startup.

## Commands

### Admin Commands
- `/start-ratmas` — Start a new gift exchange season
- `/end-ratmas` — End the current season and archive all data
- `/custom-assignments` — Send DMs for participants to choose their gift recipients
- `/package-update-query` — Send DMs asking participants to update package counts

### Participant Commands
- `/list-packages` — See how many packages are being sent to you
- `/update-packages` — Update how many packages you're sending to people

### Anonymous Messaging
Participants can send anonymous messages by DMing the bot directly. Messages are automatically routed:
- **Gift giver → receiver**: "📬 Message from someone receiving your gifts: [message]"
- **Receiver → giver**: "📬 Message from someone sending you gifts: [message]"

## Runbook

### Rotate Tokens
1. Generate a new token in [Discord Developer Portal](https://discord.com/developers/applications)
2. Update `.env` file with new `DISCORD_TOKEN` and `DISCORD_CLIENT_ID`
3. Restart the bot: `docker compose restart bot`
4. **If a token was exposed, rotate immediately**

### Production Release
- **On merge to main**: Docker image built and pushed to `ghcr.io/andrewgari/ratmas-bot:latest`
- **On tag vX.Y.Z**: Versioned release with images `:vX.Y.Z` and `:stable`

### Rollback
- Re-deploy a prior tag: `docker pull ghcr.io/andrewgari/ratmas-bot:vX.Y.Z`
- Update docker-compose.yml to use specific version
- Restart: `docker compose up -d`

## CI/CD Pipeline

### Branch Protection
- Pull requests are required for `main` branch
- All CI checks must pass before merging:
  - Docker build test
  - Multi-platform builds (amd64, arm64)

### Automated Deployment
- **On PR**: Docker build test performed
- **On merge to main**:
  - Docker image built and pushed to `ghcr.io/andrewgari/ratmas-bot:latest`
  - Deployed to self-hosted runner
- **On tag**: Versioned releases with semantic versioning (`:vX.Y.Z`, `:stable`)

### Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

## Architecture

### Technology Stack
- **Language**: Python 3.11
- **Framework**: discord.py 2.4+
- **Database**: Redis 7 (in-memory with persistence)
- **Deployment**: Docker + Docker Compose

### Data Model
- **Users**: `{user_id, display_name}` - Participants in the current season
- **Assignments**: `{sender_id, receiver_id, is_official, packages_count}` - Gift relationships
- **Archives**: Historical data from previous seasons with timestamps

### Message Flow
1. User DMs the bot
2. Bot checks if user is a sender or receiver in any assignment
3. Message is forwarded anonymously to the appropriate party
4. Replies are routed back through the same anonymous channel

## Notes

- Stores only user IDs, display names, and assignment data
- All data is archived when a season ends
- Redis persistence ensures data survives container restarts
- Anonymous messaging maintains privacy until participants choose to reveal themselves
