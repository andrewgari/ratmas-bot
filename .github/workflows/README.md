# CI/CD Pipeline Documentation

This directory contains the GitHub Actions workflows for the Ratmas Bot project.

## Active Workflows

### `ci.yml` - Main CI/CD Pipeline

This is the primary workflow that handles all continuous integration and deployment tasks.

#### On Pull Request (open/update/synchronize)

**Phase 1: Parallel Checks** ✅
- **Lint** - Code quality checks (flake8, black, isort)
- **Build** - Syntax validation and import checks
- **Test** - Run pytest test suite

**Phase 2: Docker Build and Push** 🐳
- Only runs if all Phase 1 checks pass
- Builds Docker image for `linux/amd64` and `linux/arm64`
- Pushes to GitHub Container Registry as `latest` tag
- Includes SBOM and provenance attestations
- **Required for PR merge** - PRs cannot be merged unless this succeeds

#### On Merge to Main

**Phase 3: Retag Image** 🏷️
- Pulls the existing `latest` image from GHCR
- Retags it as `stable`
- Pushes the `stable` tag
- **No rebuild** - reuses the image built during PR

### `deploy.yml` - Deploy to Unraid Server

Deploys the bot to a self-hosted Unraid server.

**Triggers:**
- Push to `main` branch (automatic deployment after merge)
- Manual trigger via `workflow_dispatch`

**Runner:**
- Runs on self-hosted runner with `unraid` label
- Falls back to `[self-hosted, ratmas]` if needed

**Steps:**
1. Creates `.env` file with Discord secrets
2. Runs `docker compose up -d --build` to deploy
3. Prunes old Docker images to save space
4. Performs health check on the bot container

**Required Secrets:**
- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID`
- `PARTICIPANT_ROLE_ID`
- `MANAGER_USER_ID`

### `setup-branch-protection.yml` - Branch Protection Setup

Manual workflow (workflow_dispatch) to configure branch protection rules for the `main` branch.

**Required Status Checks:**
- Lint
- Build
- Test
- Docker Build and Push

**Settings:**
- Requires 1 approving review
- Dismisses stale reviews
- Requires conversation resolution
- Blocks force pushes and deletions

## Archived Workflows

The following workflows have been archived and are no longer active:

- `docker-ghcr.yml.archived` - Old Docker build workflow (replaced by ci.yml)

## Docker Image Tags

Images are published to: `ghcr.io/andrewgari/ratmas-bot`

- `latest` - Built on every PR update, represents the latest PR code
- `stable` - Tagged when PR is merged to main, represents production-ready code

## Authentication

All workflows use `GITHUB_TOKEN` for authentication with GitHub Container Registry. No personal access tokens (PATs) are required.

## Workflow Diagram

```
Pull Request
├─ Phase 1 (Parallel)
│  ├─ Lint ✓
│  ├─ Build ✓
│  └─ Test ✓
└─ Phase 2 (Sequential)
   └─ Docker Build and Push ✓ → ghcr.io/.../ratmas-bot:latest

Merge to Main
├─ Phase 3 (CI/CD Pipeline)
│  └─ Retag latest → stable
└─ Deploy to Unraid (Parallel)
   ├─ Create .env with secrets
   ├─ Docker Compose up --build
   ├─ Prune old images
   └─ Health check ✓
```

## Local Testing

To test the workflows locally before pushing:

```bash
# Run linting
pip install flake8 black isort
flake8 src --count --select=E9,F63,F7,F82 --show-source --statistics
black --check src
isort --check-only src

# Run tests
pip install pytest pytest-asyncio pytest-cov
pytest tests/ -v --cov=src

# Build Docker image
docker build -t ratmas-bot:local .
```

## Troubleshooting

### CI Failing on Lint
- Run `black src` to auto-format code
- Run `isort src` to fix import ordering
- Check flake8 output for syntax errors

### Docker Build Failing
- Ensure Dockerfile is valid
- Check that all dependencies are in requirements.txt
- Verify GHCR authentication (should use GITHUB_TOKEN)

### Retag Failing on Merge
- Ensure the PR had a successful Docker build
- Check that `latest` tag exists in GHCR
- Verify GITHUB_TOKEN has packages:write permission

