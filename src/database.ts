import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, 'ratmas.sqlite');

export const db = new Database(dbPath);

db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id TEXT PRIMARY KEY,
  announcements_channel_id TEXT,
  organizer_role_id TEXT,
  timezone TEXT
);
CREATE TABLE IF NOT EXISTS event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guild_id TEXT NOT NULL,
  name TEXT NOT NULL,
  signup_deadline TEXT NOT NULL,
  buy_date TEXT NOT NULL,
  opening_day TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS participant (
  event_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  amazon_url TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  PRIMARY KEY (event_id, user_id)
);
CREATE TABLE IF NOT EXISTS match (
  event_id INTEGER NOT NULL,
  giver_user_id TEXT NOT NULL,
  receiver_user_id TEXT NOT NULL,
  PRIMARY KEY (event_id, giver_user_id)
);
`);
