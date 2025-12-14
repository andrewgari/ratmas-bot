import assert from 'node:assert/strict';
/// <reference path="../src/types/shims.d.ts" />

import { data as ratmasCmd, execute as ratmasExec } from '../src/commands/ratmas.js';
import { copy } from '../src/messages.js';
import { repo } from '../src/repo.js';
import type { TextChannel } from 'discord.js';

function makeClient(ch: TextChannel): any {
  return {
    channels: { cache: new Map([[ch.id, ch]]) },
    users: { fetch: async (_: string) => ({ send: async (_m: string) => {} }) },
  };
}

function makeChannel(id = 'annCh') {
  const sent: string[] = [];
  const ch: any = { id, send: async (m: string) => { sent.push(m); } };
  return { ch: ch as TextChannel, sent };
}

type Opts = {
  sub: string;
  group?: string | null;
  strings?: Record<string, string>;
  channelObj?: any;
  roleObj?: any;
  memberHasManageGuild?: boolean;
  organizerRoleId?: string | null;
};

function makeInteraction(opts: Opts, client: any) {
  const replies: any[] = [];
  const memberPermissions = {
    has: (_: any) => Boolean(opts.memberHasManageGuild),
  };
  const rolesCache = { has: (rid: string) => rid === 'orgRole' };
  const i: any = {
    guildId: 'guild1',
    user: { id: 'user1', globalName: 'User One', username: 'userone' },
    client,
    memberPermissions,
    inGuild: () => true,
    member: { roles: { cache: rolesCache } },
    options: {
      getSubcommand: () => opts.sub,
      getSubcommandGroup: () => (opts.group ?? null),
      getString: (name: string, required?: boolean) => {
        const v = opts.strings?.[name];
        if (v == null && required) throw new Error('missing');
        return v ?? null;
      },
      getChannel: (_name: string, _req: boolean) => opts.channelObj,
      getRole: (_name: string, _req: boolean) => opts.roleObj,
    },
    reply: async (payload: any) => { replies.push(payload); },
  };
  return { i, replies };
}

export async function runRatmasCommandTests() {
  // Validate slash command structure
  const json = ratmasCmd.toJSON();
  assert.equal((json as any).name, 'ratmas');
  const subNames = (((json as any).options) ?? []).map((o: any) => o.name);
  assert.ok(subNames.includes('open'));

  // Stubs we will override and restore
  const og = {
    getGuildSettings: repo.getGuildSettings,
    getActiveEvent: repo.getActiveEvent,
    createEvent: repo.createEvent,
    setAnnouncementsChannel: repo.setAnnouncementsChannel,
    setOrganizerRole: repo.setOrganizerRole,
  };
  try {
    // Happy path: open -> creates event, posts to announcements, replies ephemeral
    const { ch, sent } = makeChannel('annCh');
    const client = makeClient(ch);
    let created: any = null;
    repo.getGuildSettings = (_gid: string) => ({ guild_id: 'guild1', announcements_channel_id: 'annCh', organizer_role_id: 'orgRole', timezone: null });
    repo.getActiveEvent = (_gid: string) => (created && created.status !== 'cancelled' ? created : undefined);
    repo.createEvent = (e: any) => { created = { id: 1, ...e }; return created; };

    const strings = {
      name: 'Ratmas 2025',
      signup_deadline: new Date(Date.now() + 1000 * 60 * 60 * 200).toISOString(),
      buy_date: new Date(Date.now() + 1000 * 60 * 60 * 300).toISOString(),
      opening_day: new Date(Date.now() + 1000 * 60 * 60 * 400).toISOString().slice(0, 10),
      timezone: 'UTC',
    };
    const { i, replies } = makeInteraction({ sub: 'open', strings }, client);

    await ratmasExec(i as any);
    assert.equal(created?.name, 'Ratmas 2025');
    assert.ok(sent[0]?.includes('Ratmas event opened'));
    assert.equal(replies[0].ephemeral, true);

    // Idempotency: running open again should refuse when active event exists
    const { i: i2, replies: r2 } = makeInteraction({ sub: 'open', strings }, client);
    await ratmasExec(i2 as any);
    assert.ok(r2[0].content.includes('already an active'));

    // Need config: no announcements channel configured
    repo.getGuildSettings = (_: string) => ({ guild_id: 'guild1', announcements_channel_id: null, organizer_role_id: 'orgRole', timezone: null });
    created = null;
    const { i: i3, replies: r3 } = makeInteraction({ sub: 'open', strings }, client);
    await ratmasExec(i3 as any);
    assert.equal(r3[0].content, copy.needConfig);

    // Authorization: config set-channel rejected for non-organizer (no organizer role on member)
    // Return a different organizer_role_id to force roles.cache.has() -> false
    repo.getGuildSettings = (_: string) => ({ guild_id: 'guild1', announcements_channel_id: null, organizer_role_id: 'DIFFERENT_ROLE', timezone: null });
    const { i: i4, replies: r4 } = makeInteraction({ sub: 'set-channel', group: 'config', channelObj: { id: 'C' } }, client);
    await ratmasExec(i4 as any);
    assert.equal(r4[0].content, copy.notOrganizer);

    // Authorization: config set-role accepted for ManageGuild
    let setRoleCalled: any = null;
    repo.setOrganizerRole = (_gid: string, role_id: string) => { setRoleCalled = role_id; };
    const { i: i5, replies: r5 } = makeInteraction({ sub: 'set-role', group: 'config', roleObj: { id: 'ROLE123' }, memberHasManageGuild: true }, client);
    await ratmasExec(i5 as any);
    assert.ok(r5[0].content.includes('organizer role set'));
    assert.equal(setRoleCalled, 'ROLE123');
  } finally {
    repo.getGuildSettings = og.getGuildSettings;
    repo.getActiveEvent = og.getActiveEvent;
    repo.createEvent = og.createEvent;
    repo.setAnnouncementsChannel = og.setAnnouncementsChannel;
    repo.setOrganizerRole = og.setOrganizerRole;
  }
}

