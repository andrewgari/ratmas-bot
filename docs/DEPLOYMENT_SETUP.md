# Deployment Setup Guide

This guide walks you through setting up secure, automatic deployment for the Ratmas bot using Tailscale and a self-hosted GitHub Actions runner.

## Overview

The deployment workflow:

- Runs on a self-hosted runner on your server (no SSH ports exposed to the internet)
- Uses Tailscale for secure networking
- Deploys via Docker Compose on every push to `main`

## Prerequisites

- A server running Linux (Ubuntu, Debian, etc.)
- Docker and Docker Compose installed
- Admin access to the GitHub repository

## Step 1: Install Tailscale on Your Server

1. SSH into your server (however you currently access it)

2. Install Tailscale:

   ```bash
   curl -fsSL https://tailscale.com/install.sh | sh
   ```

3. Start Tailscale and authenticate:
   ```bash
   sudo tailscale up
   ```
4. Open the URL in your browser and authenticate with your Tailscale account

5. Verify installation:

   ```bash
   tailscale status
   ```

   Note your server's Tailscale IP (e.g., `100.x.x.x`) and MagicDNS name.

## Step 2: Set Up GitHub Actions Self-Hosted Runner

1. On GitHub, go to your repository: **Settings → Actions → Runners → New self-hosted runner**

2. Select **Linux** as the operating system

3. On your server, create a directory for the runner:

   ```bash
   mkdir -p ~/actions-runner && cd ~/actions-runner
   ```

4. Download the runner (use the exact commands provided by GitHub, but here's an example):

   ```bash
   curl -o actions-runner-linux-x64-2.316.0.tar.gz -L \
     https://github.com/actions/runner/releases/download/v2.316.0/actions-runner-linux-x64-2.316.0.tar.gz
   tar xzf ./actions-runner-linux-x64-2.316.0.tar.gz
   ```

5. Configure the runner (replace `<TOKEN>` with the token from GitHub):

   ```bash
   ./config.sh --url https://github.com/andrewgari/ratmas-bot --token <TOKEN>
   ```

   When prompted:
   - Runner group: Press Enter (default)
   - Runner name: Press Enter (or choose a name like "ratmas-server")
   - Work folder: Press Enter (default)
   - Labels: Press Enter (default)

6. **Option A: Run the runner interactively (for testing)**

   ```bash
   ./run.sh
   ```

7. **Option B: Install as a service (recommended for production)**
   ```bash
   sudo ./svc.sh install
   sudo ./svc.sh start
   sudo ./svc.sh status
   ```

## Step 3: Configure GitHub Secrets

Your workflow needs these secrets to create the `.env` file for your bot. Add them in GitHub:

1. Go to **Settings → Secrets and variables → Actions → New repository secret**

2. Add the following secrets:
   - `DISCORD_TOKEN` - Your Discord bot token
   - `DISCORD_CLIENT_ID` - Your Discord application client ID
   - `RATMAS_ROLE_ID` - The role ID for Ratmas participants
   - `DATABASE_URL` - The database connection string (e.g., `file:/app/data/ratmas.sqlite`)

## Step 4: Prepare Your Server Environment

1. Clone the repository on your server (if not already done):

   ```bash
   cd ~
   git clone https://github.com/andrewgari/ratmas-bot.git
   cd ratmas-bot
   ```

2. Create the data directory for the SQLite database:

   ```bash
   mkdir -p data
   ```

3. Ensure Docker is running:

   ```bash
   sudo systemctl status docker
   ```

4. Test Docker Compose:

   ```bash
   docker compose version
   ```

## Step 5: Test the Deployment

1. Push a commit to the `main` branch, or manually trigger the workflow:
   - Go to **Actions** tab in GitHub
   - Click **Deploy to Server**
   - Click **Run workflow**

2. Monitor the workflow execution in the GitHub Actions UI

3. On your server, verify the bot is running:

   ```bash
   docker compose ps
   docker compose logs -f
   ```

## Troubleshooting

### Runner not showing as online

- Check the runner service: `sudo ./svc.sh status`
- View runner logs: `journalctl -u actions.runner.andrewgari-ratmas-bot.*`

### Docker permission denied

- Add the runner user to the docker group:
  ```bash
  sudo usermod -aG docker $USER
  ```
- Restart the runner service

### Secrets not loading

- Verify secrets are set in GitHub Settings → Secrets and variables → Actions
- Check the workflow logs for specific error messages

### Container fails to start

- Check logs: `docker-compose logs`
- Verify the `.env` file was created: `cat .env`
- Ensure the database directory exists: `ls -la data/`

## Security Notes

- Port 22 (SSH) does not need to be exposed to the internet
- The runner operates within your private Tailscale network
- Secrets are never logged or exposed in GitHub Actions
- The `.env` file is recreated on each deployment and never committed to git

## Updating the Runner

GitHub occasionally releases new runner versions. To update:

```bash
cd ~/actions-runner
./svc.sh stop
./svc.sh uninstall
# Download and extract the new version
./config.sh --url https://github.com/andrewgari/ratmas-bot --token <NEW_TOKEN>
./svc.sh install
./svc.sh start
```

## Manual Deployment (Without Workflow)

If you need to deploy manually:

```bash
cd ~/ratmas-bot
git pull origin main
docker compose pull
docker compose down
docker compose up -d
```
