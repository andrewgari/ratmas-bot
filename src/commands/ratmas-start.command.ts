import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
  SlashCommandBuilder,
  SlashCommandSubcommandBuilder,
  ApplicationCommandOptionData,
} from 'discord.js';
import { RatService } from '../services/rat.service.js';
import { ChannelService } from '../services/channel.service.js';
import { RoleService } from '../services/role.service.js';
import { prepareRatmasChannel, publishWelcomeMessage } from './ratmas-start.helpers.js';
import { parseRatmasSchedule } from '../utils/date.utils.js';

export const RATMAS_COMMAND_NAME = 'ratmas';
export const RATMAS_OPT_OUT_BUTTON_ID = 'ratmas-opt-out-button';

const START_SUBCOMMAND = 'start';
const END_SUBCOMMAND = 'end';

interface RatmasStartDependencies {
  ratService: RatService;
  channelService: ChannelService;
  roleService: RoleService;
}

export async function ensureRatmasStartCommand(client: Client, guildId: string): Promise<void> {
  if (!client.application) return;

  const commands = await client.application.commands.fetch({ guildId });
  const existing = commands.find((command) => command.name === RATMAS_COMMAND_NAME);
  const startSubcommandOption = buildStartSubcommand(
    new SlashCommandSubcommandBuilder()
  ).toJSON() as unknown as ApplicationCommandOptionData;
  const endSubcommandOption = buildEndSubcommand(
    new SlashCommandSubcommandBuilder()
  ).toJSON() as unknown as ApplicationCommandOptionData;

  if (!existing) {
    const command = new SlashCommandBuilder()
      .setName(RATMAS_COMMAND_NAME)
      .setDescription('Manage Ratmas events')
      .addSubcommand((sub) => buildStartSubcommand(sub))
      .addSubcommand((sub) => buildEndSubcommand(sub));

    await client.application.commands.create(command.toJSON(), guildId);
    return;
  }

  const hasStart = existing.options.some(
    (option) => option.name === START_SUBCOMMAND && option.type === 1
  );
  const hasEnd = existing.options.some(
    (option) => option.name === END_SUBCOMMAND && option.type === 1
  );

  if (!hasStart || !hasEnd) {
    const options = existing.options.map(
      (option) => option as unknown as ApplicationCommandOptionData
    );
    if (!hasStart) options.push(startSubcommandOption);
    if (!hasEnd) options.push(endSubcommandOption);

    await existing.edit({ description: existing.description, options });
  }
}

export async function handleRatmasStartCommand(
  interaction: ChatInputCommandInteraction,
  deps: RatmasStartDependencies
): Promise<void> {
  if (interaction.commandName !== RATMAS_COMMAND_NAME) return;
  if (interaction.options.getSubcommand() !== START_SUBCOMMAND) return;

  const guard = await validateInteraction(interaction, deps.ratService);
  if (!guard.ok) {
    await interaction.reply({
      content: 'message' in guard ? guard.message : 'Error',
      ephemeral: true,
    });
    return;
  }

  try {
    await executeRatmasStart(interaction, deps, guard.ratmasRoleId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start Ratmas.';
    await interaction.reply({ content: message, ephemeral: true });
  }
}

async function executeRatmasStart(
  interaction: ChatInputCommandInteraction,
  deps: RatmasStartDependencies,
  ratmasRoleId: string
): Promise<void> {
  // Parse dates from command options
  const timezone = interaction.options.getString('timezone', true);
  const startDate = interaction.options.getString('start_date', true);
  const endDate = interaction.options.getString('end_date', true);
  const revealDate = interaction.options.getString('reveal_date', true);
  const purchaseDeadline = interaction.options.getString('purchase_deadline', true);

  const schedule = parseRatmasSchedule({
    startDate,
    endDate,
    revealDate,
    purchaseDeadline,
    timezone,
  });

  const channelInfo = await prepareRatmasChannel({
    client: interaction.client,
    guildId: interaction.guildId!,
    ratmasRoleId,
    schedule,
    channelService: deps.channelService,
  });

  await deps.ratService.createEvent({
    guildId: interaction.guildId!,
    ratmasRoleId,
    eventStartDate: schedule.eventStartDate,
    purchaseDeadline: schedule.purchaseDeadline,
    revealDate: schedule.revealDate,
    eventEndDate: schedule.eventEndDate,
    announcementChannelId: channelInfo.channelId,
  });

  await publishWelcomeMessage({
    client: interaction.client,
    channelId: channelInfo.channelId,
    schedule,
    yearLabel: channelInfo.yearLabel,
    optOutButtonId: RATMAS_OPT_OUT_BUTTON_ID,
  });

  await interaction.reply({
    content: `Ratmas ${channelInfo.yearLabel} is live in <#${channelInfo.channelId}>!`,
    ephemeral: true,
  });
}

export async function handleRatmasOptOutButton(
  interaction: ButtonInteraction,
  deps: RatmasStartDependencies
): Promise<void> {
  if (interaction.customId !== RATMAS_OPT_OUT_BUTTON_ID) return;

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This action is only available inside a server.',
      ephemeral: true,
    });
    return;
  }

  const ratmasRoleId = process.env['RATMAS_ROLE_ID'];
  if (!ratmasRoleId) {
    await interaction.reply({
      content: 'RATMAS_ROLE_ID is not configured. Let an admin know.',
      ephemeral: true,
    });
    return;
  }

  const removed = await deps.roleService.removeRoleFromMember(
    interaction.guildId,
    interaction.user.id,
    ratmasRoleId
  );

  const content = removed
    ? 'You have left Ratmas and the role has been removed.'
    : 'Could not remove the Ratmas role. You may already be opted out.';

  await interaction.reply({ content, ephemeral: true });
}

async function validateInteraction(
  interaction: ChatInputCommandInteraction,
  ratService: RatService
): Promise<{ ok: true; ratmasRoleId: string } | { ok: false; message: string }> {
  if (!interaction.guildId) {
    return { ok: false, message: 'Ratmas can only run inside a server.' };
  }

  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    return { ok: false, message: 'Only administrators can start Ratmas.' };
  }

  const ratmasRoleId = process.env['RATMAS_ROLE_ID'];
  if (!ratmasRoleId) {
    return {
      ok: false,
      message: 'RATMAS_ROLE_ID is not configured. Update the environment before starting Ratmas.',
    };
  }

  const activeEvent = await ratService.getActiveEvent(interaction.guildId);
  if (activeEvent) {
    return {
      ok: false,
      message: 'Ratmas is already in progress. End the current event before starting a new one.',
    };
  }

  return { ok: true, ratmasRoleId };
}

function buildStartSubcommand(
  subcommand: SlashCommandSubcommandBuilder
): SlashCommandSubcommandBuilder {
  return subcommand
    .setName(START_SUBCOMMAND)
    .setDescription("Start this year's Ratmas")
    .addStringOption((option) =>
      option
        .setName('timezone')
        .setDescription('Your timezone (e.g., America/New_York, Europe/London, UTC)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('start_date')
        .setDescription('Start date (YYYY-MM-DD in your timezone)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('end_date')
        .setDescription('End date (YYYY-MM-DD in your timezone)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('reveal_date')
        .setDescription('Opening day (YYYY-MM-DD in your timezone)')
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName('purchase_deadline')
        .setDescription('Purchase deadline (YYYY-MM-DD in your timezone)')
        .setRequired(true)
    );
}

function buildEndSubcommand(
  subcommand: SlashCommandSubcommandBuilder
): SlashCommandSubcommandBuilder {
  return subcommand.setName(END_SUBCOMMAND).setDescription('Complete the current Ratmas event');
}
