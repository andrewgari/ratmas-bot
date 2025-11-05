# Development Guidelines for AI Assistants

## File Organization Rules

### DO NOT create files in the repository root
- ❌ No development scripts in root (e.g., `helper.sh`, `setup.py`)
- ❌ No planning documents in root (e.g., `PLAN.md`, `SUMMARY.md`)
- ❌ No temporary files in root (e.g., `notes.txt`, `scratch.md`)

### Use proper directories instead:
- ✅ `/scripts` - For development and helper scripts
- ✅ `/docs` - For documentation and guides
- ✅ `/temp` - For temporary files, notes, and planning documents (gitignored)

### What belongs in root:
- Core config files (package.json, tsconfig.json, docker-compose.yml, etc.)
- Essential documentation (README.md, LICENSE)
- CI/CD configs (.github/workflows/)

## Files to Never Commit
- Development summaries (CI-CD-SUMMARY.md, PLAN.md, etc.)
- AI assistant scratch notes
- Helper scripts made during development
- Temporary planning documents
- Personal notes or todo lists

These should go in `/temp` which is gitignored.

## Project-Specific Notes
- This is a Discord bot for managing Secret Santa (Ratmas) events
- Focus on CI/CD, infrastructure, and deployment automation
- Keep business logic separate from infrastructure changes
