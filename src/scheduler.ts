/// <reference path="./types/shims.d.ts" />
n from 'luxon';
import { repo } from './repo.js';
import { copy } from './messages.js';
import type { Client, TextChannel } from 'discord.js';

let timers: ReturnType<typeof setTimeout>[] = [];

export function clearSchedules() {
  for (const t of timers) clearTimeout(t);
  timers = [];
}

export function scheduleForActiveEvent(client: Client, guildId: string) {
  clearSchedules();
  const ev = repo.getActiveEvent(guildId);
  if (!ev) return;
  const settings = repo.getGuildSettings(guildId);
  if (!settings.announcements_channel_id) return;
  const channel = client.channels.cache.get(settings.announcements_channel_id) as
    | TextChannel
    | undefined;
  if (!channel) return;

  const tz = ev.timezone;
  const signup = DateTime.fromISO(ev.signup_deadline, { zone: tz });
  const buy = DateTime.fromISO(ev.buy_date, { zone: tz });
  const opening = DateTime.fromISO(ev.opening_day, { zone: tz }).set({
    hour: 9,
    minute: 0,
    second: 0,
  });

  const plan: { at: Date; fn: () => Promise<void> }[] = [];
  for (const [d, label] of [
    [signup, 'signup'],
    [buy, 'buy'],
  ] as const) {
    for (const h of [72, 24]) {
      const when = d.minus({ hours: h });
      if (when > DateTime.now()) {
        plan.push({
          at: when.toJSDate(),
          fn: async () => {
            await channel.send(label === 'signup' ? copy.signupReminder(h) : copy.buyReminder(h));
          },
        });
      }
    }
  }
  if (opening > DateTime.now()) {
    plan.push({
      at: opening.toJSDate(),
      fn: async () => {
        await channel.send(copy.openingDay);
      },
    });
  }

  for (const p of plan) {
    const delay = Math.max(0, p.at.getTime() - Date.now());
    timers.push(setTimeout(() => void p.fn().catch(() => {}), delay));
  }
}
