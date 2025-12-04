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

## How It Works

### For Admins - Running a Gift Exchange

Follow these steps in order to run a successful Ratmas gift exchange:

#### Step 1: Start the Season

Run the command:

```text
/start-ratmas
```

This will:

- Initialize a new gift exchange event
- Clear any previous season data
- Prepare the bot for participant assignments

#### Step 2: Let Participants Choose Recipients

Run the command:

```text
/custom-assignments
```

This will:

- Send a DM to each participant with the participant role
- Each person selects ONE person to send gifts to (their "official gift recipient")
- Ensure everyone has at least one sender
- Allow participants to send to multiple people, but they must have one official recipient

#### Step 3: Collect Package Counts

Run the command:

```text
/package-update-query
```

This will:

- Ask everyone how many packages they're sending to each person
- Help recipients know when all gifts have arrived
- Allow participants to update counts for their official recipient and anyone else they're sending to

#### Step 4: End the Season

Run the command:

```text
/end-ratmas
```

This will:

- Archive all data from this season (unless you use `permanent=True`)
- Prepare the bot for the next event
- Save archived data with timestamps for your records

### For Participants

#### Check Your Incoming Packages

Run the command:

```text
/list-packages
```

This will:

- Show you how many packages people are sending you
- Help you know when all your gifts have arrived

#### Update Your Outgoing Packages

Run the command:

```text
/update-packages
```

This will:

- Let you tell the bot how many packages you're sending to each person
- Allow you to send to your official recipient and anyone else you want!

#### Send Anonymous Messages

Just DM the bot directly! Your messages are automatically forwarded:

- **You → Your gift recipient**: "📬 Message from someone receiving your gifts: [message]"
- **Your gift recipient → You**: They can reply and you'll receive it anonymously
- Messages are combined if sent within 5 seconds (configurable)
- Use the **Send Reminder** button if you don't get a response
- Use the **Report Issue** button if you need help from the manager

## Commands Reference

### Admin Commands

- `/start-ratmas` — **Step 1:** Initialize a new gift exchange season
- `/custom-assignments` — **Step 2:** Let participants choose who they're sending gifts to
- `/package-update-query` — **Step 3:** Ask participants how many packages they're sending
- `/end-ratmas` — **Step 4:** End the season and archive all data

### Participant Commands

- `/list-packages` — Check how many packages people are sending to you
- `/update-packages` — Tell us how many packages you're sending to each person

## Glossary

- **Season**: A single gift exchange event from start to finish
- **Participant**: Anyone with the configured participant role who can join the exchange
- **Official Gift Recipient**: The ONE person you're assigned to send gifts to (ensures everyone gets at least one sender)
- **Package Count**: How many physical packages/shipments you're sending to someone
- **Anonymous Messaging**: Send messages through the bot without revealing your identity
- **Manager**: The admin user who receives escalations and notifications (configured via `MANAGER_USER_ID`)

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
