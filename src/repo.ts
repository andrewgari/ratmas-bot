import { db } from './database.js';
import type { Event, GuildSettings, Match, Participant } from './models.js';

export const repo = {
  getGuildSettings(guild_id: string): GuildSettings {
    const row = db.prepare('SELECT * FROM guild_settings WHERE guild_id=?').get(guild_id);
    return (
      row ?? { guild_id, announcements_channel_id: null, organizer_role_id: null, timezone: null }
    );
  },
  setAnnouncementsChannel(guild_id: string, channel_id: string) {
    db.prepare(
      'INSERT INTO guild_settings (guild_id, announcements_channel_id) VALUES (?, ?)\nON CONFLICT(guild_id) DO UPDATE SET announcements_channel_id=excluded.announcements_channel_id',
    ).run(guild_id, channel_id);
  },
  setOrganizerRole(guild_id: string, role_id: string) {
    db.prepare(
      'INSERT INTO guild_settings (guild_id, organizer_role_id) VALUES (?, ?)\nON CONFLICT(guild_id) DO UPDATE SET organizer_role_id=excluded.organizer_role_id',
    ).run(guild_id, role_id);
  },
  setTimezone(guild_id: string, timezone: string) {
    db.prepare(
      'INSERT INTO guild_settings (guild_id, timezone) VALUES (?, ?)\nON CONFLICT(guild_id) DO UPDATE SET timezone=excluded.timezone',
    ).run(guild_id, timezone);
  },
  getActiveEvent(guild_id: string): Event | undefined {
    return db
      .prepare(
        "SELECT * FROM event WHERE guild_id=? AND status!='cancelled' ORDER BY id DESC LIMIT 1",
      )
      .get(guild_id);
  },
  createEvent(e: Omit<Event, 'id'>): Event {
    const stmt = db.prepare(
      `INSERT INTO event\n(guild_id,name,signup_deadline,buy_date,opening_day,timezone,status,created_by,created_at)\nVALUES (?,?,?,?,?,?,?,?,?)`,
    );
    const info = stmt.run(
      e.guild_id,
      e.name,
      e.signup_deadline,
      e.buy_date,
      e.opening_day,
      e.timezone,
      e.status,
      e.created_by,
      e.created_at,
    );
    return { id: Number(info.lastInsertRowid), ...e };
  },
  updateEventStatus(event_id: number, status: Event['status']) {
    db.prepare('UPDATE event SET status=? WHERE id=?').run(status, event_id);
  },
  listParticipants(event_id: number): Participant[] {
    return db.prepare('SELECT * FROM participant WHERE event_id=?').all(event_id) as Participant[];
  },
  upsertParticipant(p: Participant) {
    db.prepare(
      `INSERT INTO participant (event_id,user_id,display_name,amazon_url,joined_at) VALUES (?,?,?,?,?)\nON CONFLICT(event_id,user_id) DO UPDATE SET display_name=excluded.display_name, amazon_url=excluded.amazon_url`,
    ).run(p.event_id, p.user_id, p.display_name, p.amazon_url, p.joined_at);
  },
  removeParticipant(event_id: number, user_id: string) {
    db.prepare('DELETE FROM participant WHERE event_id=? AND user_id=?').run(event_id, user_id);
  },
  saveMatches(event_id: number, pairs: Match[]) {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM match WHERE event_id=?').run(event_id);
      const insert = db.prepare(
        'INSERT INTO match (event_id,giver_user_id,receiver_user_id) VALUES (?,?,?)',
      );
      for (const m of pairs) insert.run(event_id, m.giver_user_id, m.receiver_user_id);
    });
    tx();
  },
  getRecipientForGiver(event_id: number, giver_user_id: string): string | undefined {
    const row = db
      .prepare('SELECT receiver_user_id FROM match WHERE event_id=? AND giver_user_id=?')
      .get(event_id, giver_user_id) as { receiver_user_id: string } | undefined;
    return row?.receiver_user_id;
  },
  countMatches(event_id: number): number {
    const row = db.prepare('SELECT COUNT(*) AS c FROM match WHERE event_id=?').get(event_id) as
      | { c: number }
      | undefined;
    return row?.c ?? 0;
  },

  purgeEvent(event_id: number) {
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM match WHERE event_id=?').run(event_id);
      db.prepare('DELETE FROM participant WHERE event_id=?').run(event_id);
      db.prepare('DELETE FROM event WHERE id=?').run(event_id);
    });
    tx();
  },
};
