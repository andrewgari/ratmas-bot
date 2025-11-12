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
  formatDateForTimezone,
  calculateAssignmentAnnouncementDate,
} from '../utils/date.utils.js';

export const ScheduleFieldIds = {
  startDate: 'ratmas-start-date',
  endDate: 'ratmas-end-date',
  revealDate: 'ratmas-reveal-date',
  purchaseDeadline: 'ratmas-purchase-deadline',
  timezone: 'ratmas-timezone',
} as const;

export function buildScheduleModal(modalId: string): ModalBuilder {
  const modal = new ModalBuilder().setCustomId(modalId).setTitle('Ratmas Schedule');

  const fields = [
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.startDate)
      .setLabel('Start date (YYYY-MM-DD)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.endDate)
      .setLabel('End date (YYYY-MM-DD)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.revealDate)
      .setLabel('Opening day (YYYY-MM-DD)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.purchaseDeadline)
      .setLabel('Purchase deadline (YYYY-MM-DD)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true),
    new TextInputBuilder()
      .setCustomId(ScheduleFieldIds.timezone)
      .setLabel('Timezone (e.g., America/Chicago)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true),
  ];

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[0]!),
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[1]!),
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[2]!),
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[3]!),
    new ActionRowBuilder<TextInputBuilder>().addComponents(fields[4]!)
  );

  return modal;
}

export function parseScheduleFromModal(interaction: ModalSubmitInteraction): RatmasSchedule {
  return parseRatmasSchedule({
    startDate: interaction.fields.getTextInputValue(ScheduleFieldIds.startDate),
    endDate: interaction.fields.getTextInputValue(ScheduleFieldIds.endDate),
    revealDate: interaction.fields.getTextInputValue(ScheduleFieldIds.revealDate),
    purchaseDeadline: interaction.fields.getTextInputValue(ScheduleFieldIds.purchaseDeadline),
    timezone: interaction.fields.getTextInputValue(ScheduleFieldIds.timezone),
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

  const yearLabel = DateTime.fromJSDate(schedule.eventStartDate, { zone: 'utc' })
    .setZone(schedule.timezone)
    .year.toString();
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

  const startLabel = formatDateForTimezone(schedule.eventStartDate, schedule.timezone);
  const endLabel = formatDateForTimezone(schedule.eventEndDate, schedule.timezone);
  const revealLabel = formatDateForTimezone(schedule.revealDate, schedule.timezone);
  const purchaseLabel = formatDateForTimezone(schedule.purchaseDeadline, schedule.timezone);
  const assignmentLabel = calculateAssignmentAnnouncementDate(
    schedule.eventStartDate,
    schedule.timezone
  );

  const message = [
    `🎄 **Ratmas ${yearLabel} has begun!**`,
    `Ratmas runs from **${startLabel}** through **${endLabel}** (${schedule.timezone}).`,
    `Gift buying wraps up by **${purchaseLabel}**, and we'll open gifts on **${revealLabel}**.`,
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
  await channelService.setChannelPermissions(channelId, ratmasRoleId, ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions']);
}
