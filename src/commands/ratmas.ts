/// <reference path="../types/shims.d.ts" />
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChatInputCommandInteraction,
  TextChannel,
} from 'discord.js';
import type { GuildMember } from 'discord.js';

import { repo } from '../repo.js';
import { derangement } from '../match.js';
import { isValidAmazonWishlist } from '../utils/amazon.js';
import { copy } from '../messages.js';
import { scheduleForActiveEvent } from '../scheduler.js';
import { DateTime } from 'luxon';

export const data = new SlashCommandBuilder()
  .setName('ratmas')
  .setDescription('Ratmas commands for the rat that makes all the rules')
  .addSubcommandGroup((g) =>
    g
      .setName('config')
      .setDescription('Configure Ratmas')
      .addSubcommand((s) =>
        s
          .setName('set-channel')
          .setDescription('Set announcements channel')
          .addChannelOption((o) =>
            o.setName('channel').setDescription('Channel').setRequired(true),
          ),
      )
      .addSubcommand((s) =>
        s
          .setName('set-role')
          .setDescription('Set organizer role')
          .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true)),
      ),
  )
  .addSubcommand((s) =>
    s
      .setName('open')
      .setDescription('Open a new Ratmas event')
      .addStringOption((o) => o.setName('name').setDescription('Event name').setRequired(true))
      .addStringOption((o) =>
        o.setName('signup_deadline').setDescription('ISO datetime').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('buy_date').setDescription('ISO datetime').setRequired(true),
      )
      .addStringOption((o) =>
        o.setName('opening_day').setDescription('ISO date YYYY-MM-DD').setRequired(true),
      )
      .addStringOption((o) =>
        o
          .setName('timezone')
          .setDescription('IANA timezone, e.g., America/New_York')
          .setRequired(true),
      ),
  )
  .addSubcommand((s) => s.setName('lock').setDescription('Lock signups'))
  .addSubcommand((s) =>
    s
      .setName('match')
      .setDescription('Match participants')
      .addBooleanOption((o) =>
        o.setName('dry_run').setDescription('Do not save').setRequired(false),
      ),
  )
  .addSubcommand((s) => s.setName('notify').setDescription('DM assignments to participants'))
  .addSubcommand((s) =>
    s
      .setName('cancel')
      .setDescription('Cancel the event')
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
  )
  .addSubcommand((s) => s.setName('purge').setDescription('Purge all event data'))
  .addSubcommand((s) =>
    s
      .setName('join')
      .setDescription('Join Ratmas')
      .addStringOption((o) =>
        o.setName('amazon_url').setDescription('Amazon wishlist URL').setRequired(true),
      ),
  )
  .addSubcommand((s) => s.setName('status').setDescription('Show current Ratmas event status'))

  .addSubcommand((s) =>
    s
      .setName('update')
      .setDescription('Update your Amazon URL')
      .addStringOption((o) =>
        o.setName('amazon_url').setDescription('Amazon wishlist URL').setRequired(true),
      ),
  )
  .addSubcommand((s) => s.setName('leave').setDescription('Leave Ratmas'))
  .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages);

function requireOrganizer(i: ChatInputCommandInteraction): boolean {
  const settings = repo.getGuildSettings(i.guildId!);
  if (!settings.organizer_role_id) return false;
  if (i.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) return true;
  if (i.inGuild()) {
    const gm = i.member as unknown as GuildMember;
    return gm?.roles?.cache?.has(settings.organizer_role_id) ?? false;
  }
  return false;
}

export async function execute(i: ChatInputCommandInteraction) {
  if (!i.guildId) return;
  const sub = i.options.getSubcommand(true);
  const group = i.options.getSubcommandGroup(false);

  // Config
  if (group === 'config') {
    if (!requireOrganizer(i)) return i.reply({ content: copy.notOrganizer, ephemeral: true });
    if (sub === 'set-channel') {
      const ch = i.options.getChannel('channel', true);
      repo.setAnnouncementsChannel(i.guildId, ch.id);
      return i.reply({ content: `Ratmas announcements channel set to ${ch}.`, ephemeral: true });
    }
    if (sub === 'set-role') {
      const role = i.options.getRole('role', true);
      repo.setOrganizerRole(i.guildId, role.id);

      return i.reply({ content: `Ratmas organizer role set to ${role}.`, ephemeral: true });
    }
  }

  // Event lifecycle
  if (sub === 'open') {
    if (!requireOrganizer(i)) return i.reply({ content: copy.notOrganizer, ephemeral: true });
    const { announcements_channel_id } = repo.getGuildSettings(i.guildId);
    if (!announcements_channel_id) return i.reply({ content: copy.needConfig, ephemeral: true });
    const active = repo.getActiveEvent(i.guildId);
    if (active && active.status !== 'cancelled')
      return i.reply({ content: 'There is already an active Ratmas event.', ephemeral: true });

    const name = i.options.getString('name', true);
    const signup_deadline = i.options.getString('signup_deadline', true);
    const buy_date = i.options.getString('buy_date', true);
    const opening_day = i.options.getString('opening_day', true);
    const timezone = i.options.getString('timezone', true);

    repo.createEvent({
      guild_id: i.guildId,
      name,
      signup_deadline,
      buy_date,
      opening_day,
      timezone,
      status: 'open',
      created_by: i.user.id,
      created_at: new Date().toISOString(),
    });

    scheduleForActiveEvent(i.client, i.guildId);

    const ch = i.client.channels.cache.get(announcements_channel_id) as TextChannel | undefined;
    await ch?.send(copy.eventOpen(name));
    return i.reply({
      content: 'Ratmas event opened and squeaked to the announcements channel.',
      ephemeral: true,
    });
  }

  // Status
  if (sub === 'status') {
    const ev = repo.getActiveEvent(i.guildId);
    if (!ev) return i.reply({ content: 'No active Ratmas event.', ephemeral: true });

    const participants = repo.listParticipants(ev.id);
    const participantCount = participants.length;
    const matches = repo.countMatches(ev.id);

    const tz = ev.timezone;
    const fmt = (iso: string) =>
      DateTime.fromISO(iso, { zone: tz }).toFormat('yyyy-LL-dd HH:mm ZZZZ');
    const now = DateTime.now().setZone(tz);

    const signup = DateTime.fromISO(ev.signup_deadline, { zone: tz });
    const buy = DateTime.fromISO(ev.buy_date, { zone: tz });
    const opening = DateTime.fromISO(ev.opening_day, { zone: tz }).set({
      hour: 9,
      minute: 0,
      second: 0,
    });

    const signupRel =
      signup.diff(now).milliseconds >= 0
        ? `in ${signup.toRelative({ base: now })}`
        : `${signup.toRelative({ base: now })}`;
    const buyRel =
      buy.diff(now).milliseconds >= 0
        ? `in ${buy.toRelative({ base: now })}`
        : `${buy.toRelative({ base: now })}`;
    const openingRel =
      opening.diff(now).milliseconds >= 0
        ? `in ${opening.toRelative({ base: now })}`
        : `${opening.toRelative({ base: now })}`;

    const lines: string[] = [];
    lines.push(`Status: ${ev.status}`);
    lines.push(`Participants: ${participantCount}`);
    if (ev.status === 'matched' || ev.status === 'notified')
      lines.push(`Matched pairs: ${matches}`);
    lines.push(`Signup deadline (${tz}): ${fmt(ev.signup_deadline)} (${signupRel})`);
    lines.push(`Buy date (${tz}): ${fmt(ev.buy_date)} (${buyRel})`);
    lines.push(`Opening day (${tz}): ${opening.toFormat('yyyy-LL-dd HH:mm ZZZZ')} (${openingRel})`);

    if (requireOrganizer(i)) {
      const s = repo.getGuildSettings(i.guildId);
      lines.push(`Announcements channel ID: ${s.announcements_channel_id ?? 'not set'}`);
      lines.push(`Organizer role ID: ${s.organizer_role_id ?? 'not set'}`);
    }

    return i.reply({ content: lines.join('\n'), ephemeral: true });
  }

  if (sub === 'lock') {
    if (!requireOrganizer(i)) return i.reply({ content: copy.notOrganizer, ephemeral: true });
    const ev = repo.getActiveEvent(i.guildId);
    if (!ev || ev.status !== 'open')
      return i.reply({ content: 'No open Ratmas event to lock.', ephemeral: true });
    repo.updateEventStatus(ev.id, 'locked');
    const chId = repo.getGuildSettings(i.guildId).announcements_channel_id;
    const ch = chId ? (i.client.channels.cache.get(chId) as TextChannel | undefined) : undefined;
    await ch?.send(copy.eventLocked);
    return i.reply({ content: 'Ratmas signups locked.', ephemeral: true });
  }

  if (sub === 'match') {
    if (!requireOrganizer(i)) return i.reply({ content: copy.notOrganizer, ephemeral: true });
    const ev = repo.getActiveEvent(i.guildId);
    if (!ev || (ev.status !== 'open' && ev.status !== 'locked'))
      return i.reply({ content: 'No event ready to match.', ephemeral: true });
    const participants = repo.listParticipants(ev.id);
    const ids = participants.map((p) => p.user_id);
    const deranged = derangement(ids);
    if (!deranged) return i.reply({ content: 'Failed to match (try again).', ephemeral: true });
    const pairs = ids.map((giver, idx) => ({
      event_id: ev.id,
      giver_user_id: giver,
      receiver_user_id: deranged[idx],
    }));
    const dry = i.options.getBoolean('dry_run') ?? false;
    if (!dry) {
      repo.saveMatches(ev.id, pairs);
      repo.updateEventStatus(ev.id, 'matched');
    }
    return i.reply({
      content: dry ? 'Dry-run derangement complete.' : copy.eventMatched,
      ephemeral: true,
    });
  }

  if (sub === 'notify') {
    if (!requireOrganizer(i)) return i.reply({ content: copy.notOrganizer, ephemeral: true });
    const ev = repo.getActiveEvent(i.guildId);
    if (!ev || ev.status !== 'matched')
      return i.reply({ content: 'No matched event to notify.', ephemeral: true });
    const participants = repo.listParticipants(ev.id);
    for (const p of participants) {
      const recipientId = repo.getRecipientForGiver(ev.id, p.user_id);
      if (!recipientId) continue;
      try {
        const recipient = await i.client.users.fetch(recipientId);
        await (
          await i.client.users.fetch(p.user_id)
        ).send(
          `Your Ratmas recipient is: ${recipient.globalName ?? recipient.username}\nAmazon URL: ${participants.find((x) => x.user_id === recipientId)?.amazon_url ?? 'No URL provided'}`,
        );
      } catch {
        const chId = repo.getGuildSettings(i.guildId).announcements_channel_id;
        const ch = chId
          ? (i.client.channels.cache.get(chId) as TextChannel | undefined)
          : undefined;
        await ch?.send(copy.dmDisabled(`<@${p.user_id}>`));
      }
    }
    repo.updateEventStatus(ev.id, 'notified');
    const chId = repo.getGuildSettings(i.guildId).announcements_channel_id;
    const ch = chId ? (i.client.channels.cache.get(chId) as TextChannel | undefined) : undefined;
    await ch?.send(copy.eventNotified);
    return i.reply({ content: 'Ratmas notifications sent.', ephemeral: true });
  }

  if (sub === 'cancel') {
    if (!requireOrganizer(i)) return i.reply({ content: copy.notOrganizer, ephemeral: true });
    const ev = repo.getActiveEvent(i.guildId);
    if (!ev) return i.reply({ content: 'No active Ratmas event to cancel.', ephemeral: true });
    repo.updateEventStatus(ev.id, 'cancelled');
    scheduleForActiveEvent(i.client, i.guildId);
    return i.reply({ content: 'Ratmas event cancelled.', ephemeral: true });
  }

  if (sub === 'purge') {
    if (!requireOrganizer(i)) return i.reply({ content: copy.notOrganizer, ephemeral: true });
    const ev = repo.getActiveEvent(i.guildId);
    if (!ev) return i.reply({ content: 'No Ratmas event to purge.', ephemeral: true });
    repo.purgeEvent(ev.id);
    scheduleForActiveEvent(i.client, i.guildId);
    return i.reply({ content: 'Ratmas event data purged.', ephemeral: true });
  }

  // Participants
  if (sub === 'join' || sub === 'update') {
    const ev = repo.getActiveEvent(i.guildId);
    if (!ev || ev.status !== 'open')
      return i.reply({ content: 'No open Ratmas event to join.', ephemeral: true });
    const amazon_url = i.options.getString('amazon_url', true);
    if (!isValidAmazonWishlist(amazon_url))
      return i.reply({ content: 'Please provide a valid Amazon wishlist URL.', ephemeral: true });
    repo.upsertParticipant({
      event_id: ev.id,
      user_id: i.user.id,
      display_name: i.user.globalName ?? i.user.username,
      amazon_url,
      joined_at: new Date().toISOString(),
    });
    return i.reply({
      content: sub === 'join' ? 'Joined Ratmas. Squeak squeak!' : 'Updated your Amazon URL.',
      ephemeral: true,
    });
  }

  if (sub === 'leave') {
    const ev = repo.getActiveEvent(i.guildId);
    if (!ev || ev.status !== 'open')
      return i.reply({
        content: 'You can only leave before Ratmas signups are locked.',
        ephemeral: true,
      });
    repo.removeParticipant(ev.id, i.user.id);
    return i.reply({ content: "You have left Ratmas. We'll miss your whiskers.", ephemeral: true });
  }
}
