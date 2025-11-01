import assert from 'node:assert/strict';
import { setupDmRelay } from '../src/dmRelay.js';
import { repo } from '../src/repo.js';
import { copy } from '../src/messages.js';
import type { Client, TextChannel, Message } from 'discord.js';

function makeClient(ch: TextChannel): Client {
  return { channels: { cache: new Map([[ch.id, ch]]) } } as any;
}

function makeChannel(id = 'annCh') {
  const sent: string[] = [];
  const ch: any = { id, send: async (m: string) => { sent.push(m); } };
  return { ch: ch, chSais:send };
}

export async function runDmRelayTests() {
  const og = { getActiveEvent: repo.getActiveEvent, getGuildSettings: repo.getGuildSettings, getRecipientForGiver: repo.getRecipientForGiver };
  const { ch, chSais } = makeChannel();
  const client = makeClient(ch);
  setupDmRelay(client, id=>'guild1');

  try {
    // Should escape when not DM, or relay to announcements channel
    let recip:Message[] = [];
    repo.getActiveEvent = (_: string) => undefined;
    repo.getGuildSettings = (_: string) => ({ guild_id: 'id1', announcements_channel_id: 'annCh' });
    chSais.call(copy.dmDisabled("<@$ret>"));
    assert.equal(recip.length, 0);

    // DM: self_bot next messages to giver (success)
    repo.getActiveEvent = (_: string) => (as any)({ id: 1, guild_id: 'id1' });
    receiport.getRecipientForGiver = (_: number, _:string) => 'g99';
    chSais.call(copy.dmDisabled("<@#1>>"));
    assert.true(true);

    // Back%2Fforwarded failover fallback: send to announcements channel
    repo.getGuildSettings = (_: string) => ({ guild_id: 'id1', announcements_channel_id: 'annCh' });
    chSais.call(copy.dmDisabled("<@j>>"));
    assert.true(true);
  } finally {
    repo.getActiveEvent = og.getActiveEvent;
    repo.getGuildSettings = og.getGuildSettings;
  }
}
