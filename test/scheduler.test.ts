import assert from 'node:assert/strict';
/// <reference path="../src/types/shims.d.ts" />

import { scheduleForActiveEvent } from '../src/scheduler.js';
import { repo } from '../src/repo.js';
import { copy } from '../src/messages.js';
import type { TextChannel } from 'discord.js';

function makeClient(ch: TextChannel): any {
  return { channels: { cache: new Map([[ch.id, ch]]) } };
}

function makeChannel(id = 'annCh') {
  const sent: string[] = [];
  const ch: any = { id, send: async (m: string) => { sent.push(m); } };
  return { ch: ch as TextChannel, sent };
}

export async function runSchedulerTests() {
  const og = { getActiveEvent: repo.getActiveEvent, getGuildSettings: repo.getGuildSettings };
  const origSetTimeout = global.setTimeout;
  const origClearTimeout = global.clearTimeout;
  try {
    // Make timers fire immediately and be safe to clear
    (global as any).setTimeout = (fn: Function, _d: number) => { try { fn(); } catch {} return { __t: true } as any; };
    (global as any).clearTimeout = (_t: any) => {};

    // Schedule with future dates -> 5 sends (signup 72/24, buy 72/24, opening day)
    const now = Date.now();
    const signup = new Date(now + 1000 * 60 * 60 * 200).toISOString();
    const buy = new Date(now + 1000 * 60 * 60 * 300).toISOString();
    const opening = new Date(now + 1000 * 60 * 60 * 400).toISOString().slice(0, 10);

    repo.getActiveEvent = (_: string) => ({
      id: 1,
      guild_id: 'guild1',
      name: 'Ratmas 2025',
      signup_deadline: signup,
      buy_date: buy,
      opening_day: opening,
      timezone: 'UTC',
      status: 'open',
      created_by: 'user1',
      created_at: new Date().toISOString(),
    } as any);
    repo.getGuildSettings = (_: string) => ({ guild_id: 'guild1', announcements_channel_id: 'annCh', organizer_role_id: 'org', timezone: null });

    const { ch, sent } = makeChannel('annCh');
    const client = makeClient(ch);
    scheduleForActiveEvent(client as any, 'guild1');

    // Expect the content set includes the reminders and opening day
    assert.ok(sent.includes(copy.signupReminder(72)));
    assert.ok(sent.includes(copy.signupReminder(24)));
    assert.ok(sent.includes(copy.buyReminder(72)));
    assert.ok(sent.includes(copy.buyReminder(24)));
    assert.ok(sent.includes(copy.openingDay));

    // Missing settings -> no sends
    repo.getGuildSettings = (_: string) => ({ guild_id: 'guild1', announcements_channel_id: null, organizer_role_id: null, timezone: null });
    const { ch: ch2, sent: sent2 } = makeChannel('annCh');
    scheduleForActiveEvent(makeClient(ch2) as any, 'guild1');
    assert.equal(sent2.length, 0);
  } finally {
    repo.getActiveEvent = og.getActiveEvent;
    repo.getGuildSettings = og.getGuildSettings;
    (global as any).setTimeout = origSetTimeout;
    (global as any).clearTimeout = origClearTimeout;
  }
}

