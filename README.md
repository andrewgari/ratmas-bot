# Ratmas Bot

A Ratmas (rat-Christmas) Discord bot to run a single Ratmas event per server.

## Features

- Organizer role + announcements channel via slash commands
- Event lifecycle: open → join/leave → lock → match → notify → reminders → opening day
- One-way DM relay (Santa → recipient)
- SQLite storage (file persisted to ./data)

## Quick start

1. Create env file:
   - Local dev (from ratmas-bot/): cp .env.example .env
   - Docker Compose (from repo root): cp ratmas-bot/.env.example ratmas-bot/.env
2. Local development (recommended first run):
   - cd ratmas-bot && npm install
   - npm run dev
3. Or build and run with Docker Compose (from repo root):
   - docker compose up -d

## Configuration

- GUILD_ID: primary guild for this environment (e.g., staging when testing, production in prod).
- STAGING_GUILD_ID (optional): convenience reference for staging server.
- ALLOWED_GUILD_IDS (optional, CSV): if set, bot only responds in these guilds. Defaults to [GUILD_ID, STAGING_GUILD_ID].
- ALLOWED_CHANNEL_IDS (optional, CSV): restricts command handling to specific channels (use raw channel IDs).

Slash commands register to the specified guild on startup.

## Commands

- /ratmas status — Show current event status, participant count, matched pairs (if applicable), and key dates in the event timezone.
- /ratmas config set-channel — Set announcements channel.
- /ratmas config set-role — Set organizer role.
- /ratmas open — Open an event with ISO dates and an IANA timezone.
- /ratmas join|update|leave — Participant actions.
- /ratmas lock|match|notify|cancel|purge — Organizer lifecycle actions.

## Runbook

- Rotate tokens:
  - Generate a new token in Discord Developer Portal.
  - Update ratmas-bot/.env (DISCORD_TOKEN, CLIENT_ID, GUILD_ID). Do not commit secrets.
  - If a token was exposed, rotate immediately.
- Staging release:
  - From GitHub Actions, run Release workflow with release_channel=staging.
  - A pre-release is created and a :staging Docker image is built for ghcr.io (if permissions allow).
- Production release:
  - Create a tag vX.Y.Z on main. The Release workflow will create a full release and publish images :vX.Y.Z and :latest.
- Rollback:
  - Re-deploy a prior tag (e.g., checkout previous tag and re-run docker workflow) or re-run Release for an earlier version.

## CI/CD Pipeline

### Branch Protection

- Pull requests are required for `main` branch
- All CI checks must pass before merging:
  - Linting (ESLint)
  - Code formatting (Prettier)
  - TypeScript compilation
  - Test suite execution
  - Docker build test

### Automated Deployment

- **On PR**: CI tests run, Docker build test performed
- **On merge to main**: Docker image built and pushed to `ghcr.io/andrewgari/ratmas-bot:latest`
- **On tag**: Versioned releases with semantic versioning

### Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for production deployment instructions.

## Notes

- Stores only display name + Amazon URL + event metadata/matches.
- Purge removes all event data.
