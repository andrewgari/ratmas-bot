import { ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';
import { RatService } from '../services/rat.service.js';
import { RATMAS_COMMAND_NAME } from './ratmas-start.command.js';

const END_SUBCOMMAND = 'end';

interface RatmasEndDependencies {
  ratService: RatService;
}

export async function handleRatmasEndCommand(
  interaction: ChatInputCommandInteraction,
  deps: RatmasEndDependencies
): Promise<void> {
  if (interaction.commandName !== RATMAS_COMMAND_NAME) return;
  if (interaction.options.getSubcommand() !== END_SUBCOMMAND) return;

  // Check permissions
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({
      content: '❌ You need Administrator permissions to end Ratmas events.',
      ephemeral: true,
    });
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({
      content: '❌ This command must be used in a server.',
      ephemeral: true,
    });
    return;
  }

  try {
    const event = await deps.ratService.getActiveEvent(interaction.guildId);
    if (!event) {
      await interaction.reply({
        content: '❌ No active Ratmas event found.',
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply();

    await deps.ratService.completeEvent(event.id);

    await interaction.editReply(
      '✅ Ratmas event has been completed! Thank you to all participants! 🎄🐀'
    );
  } catch (error) {
    console.error('Error completing Ratmas event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (interaction.deferred) {
      await interaction.editReply(`❌ Failed to complete Ratmas event: ${errorMessage}`);
    } else {
      await interaction.reply({
        content: `❌ Failed to complete Ratmas event: ${errorMessage}`,
        ephemeral: true,
      });
    }
  }
}
