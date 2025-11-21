import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  ModalBuilder,
  ModalSubmitInteraction,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { DateTime } from 'luxon';
import { ChannelService } from '../services/channel.service.js';
import {
  RatmasSchedule,
  parseRatmasSchedule,
  toDiscordTimestamp,
  calculateAssignmentAnnouncementDate,
} from '../utils/date.utils.js';

export const ScheduleFieldIds = {
  startDate: 'ratmas-start-date',
  endDate: 'ratmas-end-date',
  revealDate: 'ratmas-reveal-date',
  purchaseDeadline: 'ratmas-purchase-deadline',
} as const;

export function buildScheduleModal(modalId: string): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(modalId).setTitle('Ratmas Schedule (UTC)');

  const fields = [
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.startDate)
      .setLabel('Start date (YYYY-MM-DD) UTC')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 2025-12-01')
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.endDate)
      .setLabel('End date (YYYY-MM-DD) UTC')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 2025-12-26')
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.revealDate)
      .setLabel('Opening day (YYYY-MM-DD) UTC')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 2025-12-26')
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.purchaseDeadline)
      .setLabel('Purchase deadline (YYYY-MM-DD) UTC')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g., 2025-12-16')
      .setRequired(true),
  ];

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[0]!),
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[1]!),
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[2]!),
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[3]!)
  );

  return modal;
}

export function parseScheduleFromModal(interaction: ModalSubmitInteraction): RatmasSchedule {
  return parseRatmasSchedule({
    startDate: interaction.fields.getTextInputValue(ScheduleFieldIds.startDate),
    endDate: interaction.fields.getTextInputValue(ScheduleFieldIds.endDate),
    revealDate: interaction.fields.getTextInputValue(ScheduleFieldIds.revealDate),
    purchaseDeadline: interaction.fields.getTextInputValue(ScheduleFieldIds.purchaseDeadline),
  });
}

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
