export type GuildSettings = {
  guild_id: string;
  announcements_channel_id: string | null;
  organizer_role_id: string | null;
  timezone: string | null;
};

export type EventStatus = 'open' | 'locked' | 'matched' | 'notified' | 'cancelled';

export type Event = {
  id: number;
  guild_id: string;
  name: string;
  signup_deadline: string; // ISO
  buy_date: string; // ISO
  opening_day: string; // ISO (date)
  timezone: string; // IANA tz
  status: EventStatus;
  created_by: string; // user id
  created_at: string; // ISO
};

export type Participant = {
  event_id: number;
  user_id: string;
  display_name: string;
  amazon_url: string;
  joined_at: string;
};

export type Match = {
  event_id: number;
  giver_user_id: string;
  receiver_user_id: string;
};
