import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  TextChannel,
} from 'discord.js';
import { DateTime } from 'luxon';
import { ChannelService } from '../services/channel.service.js';
import {
  RatmasSchedule,
  toDiscordTimestamp,
  calculateAssignmentAnnouncementDate,
} from '../utils/date.utils.js';

export async function prepareRatmasChannel(params: {
  client: Client;
  guildId: string;
  ratmasRoleId: string;
  schedule: RatmasSchedule;
  channelService: ChannelService;
}): Promise<{ channelId: string; yearLabel: string }> {
  const { client, guildId, ratmasRoleId, schedule, channelService } = params;
  const guild = await client.guilds.fetch(guildId);
  const channels = await guild.channels.fetch();

  const yearLabel = DateTime.fromJSDate(schedule.eventStartDate, { zone: 'utc' }).year.toString();
  const channelName = `ratmas-${yearLabel}`;

  const existing = channels.find(
    (channel): channel is TextChannel =>
      !!channel &&
      channel.type === ChannelType.GuildText &&
      channel.name.toLowerCase() === channelName
  );

  if (existing) {
    await applyRatmasPermissions({
      channelService,
      channelId: existing.id,
      ratmasRoleId,
      everyoneRoleId: guild.roles.everyone.id,
    });
    return { channelId: existing.id, yearLabel };
  }

  const createResult = await channelService.createTextChannel(guildId, {
    name: channelName,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        type: 'role',
        deny: ['ViewChannel'],
      },
      {
        id: ratmasRoleId,
        type: 'role',
        allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions'],
      },
    ],
  });

  if (!createResult.success || !createResult.channelId) {
    throw new Error(createResult.error ?? 'Failed to create Ratmas channel.');
  }

  return { channelId: createResult.channelId, yearLabel };
}

export async function publishWelcomeMessage(params: {
  client: Client;
  channelId: string;
  schedule: RatmasSchedule;
  yearLabel: string;
  optOutButtonId: string;
}): Promise<void> {
  const { client, channelId, schedule, yearLabel, optOutButtonId } = params;
  const channel = await client.channels.fetch(channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    throw new Error('Ratmas channel is not a text channel.');
  }

  const startLabel = toDiscordTimestamp(schedule.eventStartDate, 'D');
  const endLabel = toDiscordTimestamp(schedule.eventEndDate, 'D');
  const revealLabel = toDiscordTimestamp(schedule.revealDate, 'D');
  const purchaseLabel = toDiscordTimestamp(schedule.purchaseDeadline, 'D');
  const assignmentLabel = calculateAssignmentAnnouncementDate(schedule.eventStartDate);

  const message = [
    `🎄 **Ratmas ${yearLabel} has begun!**`,
    `Ratmas runs from ${startLabel} through ${endLabel} (UTC).`,
    `Gift buying wraps up by ${purchaseLabel}, and we'll open gifts on ${revealLabel}.`,
    `Secret Santas will be assigned via DM in five days (${assignmentLabel}).`,
    'If you want to opt out, use the button below to remove the Ratmas role.',
  ].join('\n');

  const components = [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(optOutButtonId)
        .setLabel('Leave Ratmas')
        .setStyle(ButtonStyle.Danger)
    ),
  ];

  await (channel as TextChannel).send({ content: message, components });
}

async function applyRatmasPermissions(params: {
  channelService: ChannelService;
  channelId: string;
  ratmasRoleId: string;
  everyoneRoleId: string;
}): Promise<void> {
  const { channelService, channelId, ratmasRoleId, everyoneRoleId } = params;
  await channelService.setChannelPermissions(channelId, everyoneRoleId, [], ['ViewChannel']);
  await channelService.setChannelPermissions(channelId, ratmasRoleId, [
    'ViewChannel',
    'SendMessages',
    'ReadMessageHistory',
    'AddReactions',
  ]);
}
