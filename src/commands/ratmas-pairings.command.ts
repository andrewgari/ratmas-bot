import {
  ChatInputCommandInteraction,
  Client,
  SlashCommandBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import { RatService } from '../services/rat.service.js';

export const RATMAS_PAIRINGS_COMMAND = 'pairings';

export function buildPairingsCommand(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName(RATMAS_PAIRINGS_COMMAND)
    .setDescription('Commence Ratmas pairings (admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
}

export async function ensurePairingsCommand(client: Client, guildId: string): Promise<void> {
  if (!client.application) return;

  const commands = await client.application.commands.fetch({ guildId });
  const existing = commands.find((command) => command.name === RATMAS_PAIRINGS_COMMAND);

  if (!existing) {
    const command = buildPairingsCommand();
    await client.application.commands.create(command.toJSON(), guildId);
  }
}

export async function handlePairingsCommand(
  interaction: ChatInputCommandInteraction,
  ratService: RatService
): Promise<void> {
  if (interaction.commandName !== RATMAS_PAIRINGS_COMMAND) return;

  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }
  try {
    const event = await ratService.getActiveEvent(interaction.guildId);
    if (!event) throw new Error('No active Ratmas event.');
    const result = await ratService.generatePairings(event.id);
    if (result.success) {
      await interaction.reply({
        content: `Pairings complete! ${result.pairingsCreated} pairs generated.`,
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: `Failed to generate pairings: ${result.error || 'Unknown error'}`,
        ephemeral: true,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to commence pairings.';
    await interaction.reply({ content: msg, ephemeral: true });
  }
}
