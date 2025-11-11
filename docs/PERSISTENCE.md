# Ratmas Service - Persistence Layer

## Overview

Ratmas persists data in SQLite through Prisma. The previous in-memory maps and migration plan have been replaced with a concrete implementation that stores events, participants, and pairings in a relational schema. This document describes the schema, repository responsibilities, and operational notes for the current system.

## Schema Summary

The Prisma schema lives in `prisma/schema.prisma`. Prisma generates a type-safe client under `node_modules/.prisma/client` (and exposed via `@prisma/client`). Key models mirror the domain types in `src/types/ratmas.types.ts`.

### `RatmasEvent`

- Identifies a guild's Ratmas configuration and lifecycle (`status`, `eventStartDate`, `purchaseDeadline`, `revealDate`).
- Tracks announcement channel, managing role, timezone, and timestamps.
- Cascades deletes to associated participants and pairings.
- Indexed by `guildId` and `status` to quickly locate active events.

### `RatmasParticipant`

- Represents a Discord user enrolled in a specific Ratmas event.
- `(eventId, userId)` is unique, ensuring duplicate enrolments are rejected.
- Persists display names and optional wishlist URLs for DM notifications.

### `RatmasPairing`

- Stores Santa-to-recipient mappings per event.
- Guarantees uniqueness so a Santa has exactly one recipient and vice versa within an event.
- `notifiedAt` records the time a Santa DM succeeded, allowing retries for failures.

## Repository Responsibilities

`src/repositories/ratmas.repository.ts` is the single abstraction over Prisma.

- Creates and updates events (`createEvent`, `setStatus`, `getActiveEvent`, etc.).
- Synchronises participants with Discord roles, removing stale entries and adding new ones.
- Replaces pairings atomically via `replacePairings`, ensuring partial updates are rolled back on error.
- Marks successful DM notifications (`markPairingsNotified`) so retries only target pending Santas.
- Normalises Prisma outputs to the domain shapes consumed by services.

The repository relies on the shared client exported from `src/persistence/prisma-client.ts`, which keeps a singleton in development to avoid exhausting SQLite connections during hot reloads.

## Service Integration

`src/services/rat.service.ts` now depends on the repository instead of in-memory maps. All service methods are asynchronous and:

- Fetch the active event state via the repository.
- Delegate participant sync/notification helpers in `rat.service.operations.ts`.
- Persist generated pairings and notification outcomes.

Call sites should `await` repository-backed methods that previously returned synchronously.

## Configuration

- `DATABASE_URL` controls the SQLite location (e.g. `file:./data/ratmas.sqlite`).
- `DATABASE_PATH` is a legacy environment variable and is not used by Prisma. Remove it unless your deployment scripts rely on the value.
- The `data/` directory is gitignored and created automatically by Prisma when the database is first accessed.

## Development Workflow

1. Install dependencies (`npm install`) to pull Prisma packages.
2. Generate the client when schema changes (`npx prisma generate`).
3. Run the TypeScript build (`npm run build`) and Jest tests (`npm test`) to validate runtime behaviour.
4. For schema updates, consider migrations (`npx prisma migrate dev`) if the production environment requires structured upgrades.

## Migration Notes

- Consumers of `RatService` can retain existing method calls; they simply need to handle asynchronous results.
- Legacy data (if any) should be imported using Prisma scripts or `sqlite3` directly; no automatic migration from in-memory data exists.
- Tests can point `DATABASE_URL` to `file::memory:?cache=shared` when isolation is required.

## Data Location

- Local development: `./data/ratmas.sqlite` (configurable via `DATABASE_URL`).
- Docker: `/app/data/ratmas.sqlite`, mounted from the host to persist across container restarts.
- Backups: copy the SQLite file while the bot is stopped to ensure consistency.

## Backup Strategy

- Schedule periodic copies of the SQLite file to a safe location.
- Offer an export command that serialises events, participants, and pairings to JSON for archival.
- Before deletion or archival operations, capture a snapshot of the database for recovery.
