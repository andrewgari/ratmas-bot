# Ratmas Service - Persistence Layer Plan

## Overview

The RatService currently uses in-memory Maps for storage. This document outlines the plan to integrate SQLite persistence as mentioned in the README.

## Database Schema

### Tables

#### `events`

```sql
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  guild_id TEXT NOT NULL,
  status TEXT NOT NULL,
  ratmas_role_id TEXT NOT NULL,  -- Discord role that links all participants
  event_start_date TEXT NOT NULL,  -- ISO 8601 format
  purchase_deadline TEXT NOT NULL,  -- ISO 8601 format
  reveal_date TEXT NOT NULL,        -- ISO 8601 format
  timezone TEXT NOT NULL,
  announcement_channel_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CONSTRAINT unique_active_event UNIQUE (guild_id, status)
    WHERE status NOT IN ('completed', 'cancelled')
);

CREATE INDEX idx_events_guild ON events(guild_id);
CREATE INDEX idx_events_status ON events(status);
```

#### `participants`

```sql
CREATE TABLE participants (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  guild_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  wishlist_url TEXT,
  joined_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE (event_id, user_id)
);

CREATE INDEX idx_participants_event ON participants(event_id);
CREATE INDEX idx_participants_user ON participants(user_id);
```

#### `pairings`

```sql
CREATE TABLE pairings (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  santa_id TEXT NOT NULL,
  recipient_id TEXT NOT NULL,
  notified_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (santa_id) REFERENCES participants(id) ON DELETE CASCADE,
  FOREIGN KEY (recipient_id) REFERENCES participants(id) ON DELETE CASCADE,
  UNIQUE (event_id, santa_id),
  UNIQUE (event_id, recipient_id)
);

CREATE INDEX idx_pairings_event ON pairings(event_id);
CREATE INDEX idx_pairings_santa ON pairings(santa_id);
```

## Repository Pattern

### `src/repositories/ratmas.repository.ts`

Create a repository class to handle all database operations:

```typescript
export class RatmasRepository {
  // Event operations
  async saveEvent(event: RatmasEvent): Promise<void>;
  async getEvent(eventId: string): Promise<RatmasEvent | null>;
  async getActiveEvent(guildId: string): Promise<RatmasEvent | null>;
  async updateEventStatus(eventId: string, status: RatmasEventStatus): Promise<void>;

  // Participant operations
  async saveParticipant(participant: RatmasParticipant): Promise<void>;
  async getParticipant(participantId: string): Promise<RatmasParticipant | null>;
  async getParticipants(eventId: string): Promise<RatmasParticipant[]>;
  async getParticipantByUserId(eventId: string, userId: string): Promise<RatmasParticipant | null>;
  async deleteParticipant(participantId: string): Promise<void>;
  async updateParticipant(participantId: string, updates: UpdateParticipantOptions): Promise<void>;

  // Pairing operations
  async savePairing(pairing: RatmasPairing): Promise<void>;
  async savePairings(pairings: RatmasPairing[]): Promise<void>;
  async getPairingForSanta(eventId: string, santaId: string): Promise<RatmasPairing | null>;
  async getPairings(eventId: string): Promise<RatmasPairing[]>;
  async updatePairingNotified(pairingId: string, notifiedAt: Date): Promise<void>;
}
```

## Implementation Steps

1. **Add SQLite dependency**

   ```bash
   npm install better-sqlite3
   npm install -D @types/better-sqlite3
   ```

2. **Create database initialization script**
   - Create `src/db/init.ts` with schema migrations
   - Create `src/db/connection.ts` for database connection management

3. **Implement RatmasRepository**
   - Create repository class with all CRUD operations
   - Handle date serialization/deserialization (ISO 8601 strings)
   - Implement transactions for atomic operations

4. **Update RatService**
   - Replace Map-based storage with repository calls
   - Inject repository via constructor
   - Keep existing method signatures unchanged

5. **Add database configuration**
   - Add to `.env`:
     ```
     DATABASE_PATH=./data/ratmas.db
     ```
   - Ensure `./data` directory exists

6. **Testing considerations**
   - Use in-memory SQLite (`:memory:`) for unit tests
   - Create test fixtures for common scenarios
   - Test transaction rollback on errors

## Migration Strategy

The RatService interface remains unchanged, so migration is internal only:

1. Implement repository alongside existing Map storage
2. Add feature flag to switch between storage backends
3. Test thoroughly with repository backend
4. Remove Map-based storage once validated
5. No changes needed to consumers of RatService

## Data Persistence Location

Following the README specification:

- Production: `./data/ratmas.db`
- Docker: Volume mount at `/app/data`
- Development: Local `./data` directory (gitignored)

## Backup Strategy

Consider implementing:

- Periodic database backups to separate files
- Export functionality for event data (JSON format)
- Purge command should backup before deletion
