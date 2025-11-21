import {
  ChatInputCommandInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} from 'discord.js';
import { RatService } from '../services/rat.service.js';

export const RATMAS_WISHLIST_COMMAND = 'wishlist';
export const RATMAS_WISHLIST_MODAL_ID = 'ratmas-wishlist-modal';
export const RATMAS_WISHLIST_INPUT_ID = 'ratmas-wishlist-url';

export function buildWishlistCommand(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName(RATMAS_WISHLIST_COMMAND)
    .setDescription('Submit or update your Ratmas wishlist link');
}

export function buildWishlistModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(RATMAS_WISHLIST_MODAL_ID)
    .setTitle('Submit Your Wishlist');

  const wishlistInput = new TextInputBuilder()
    .setCustomId(RATMAS_WISHLIST_INPUT_ID)
    .setLabel('Wishlist URL (Amazon, etc)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://www.amazon.com/hz/wishlist/...')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(wishlistInput));
  return modal;
}

export async function handleWishlistCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  if (interaction.commandName !== RATMAS_WISHLIST_COMMAND) return;
  await interaction.showModal(buildWishlistModal());
}

export async function handleWishlistModal(
  interaction: ModalSubmitInteraction,
  ratService: RatService
): Promise<void> {
  if (interaction.customId !== RATMAS_WISHLIST_MODAL_ID) return;
  if (!interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
    return;
  }
  const wishlistUrl = interaction.fields.getTextInputValue(RATMAS_WISHLIST_INPUT_ID).trim();
  if (!/^https?:\/\//.test(wishlistUrl)) {
    await interaction.reply({ content: 'Please provide a valid URL.', ephemeral: true });
    return;
  }
  try {
    const event = await ratService.getActiveEvent(interaction.guildId);
    if (!event) throw new Error('No active Ratmas event.');
    const participant = await ratService.getOrCreateParticipant(
      event.id,
      interaction.user.id,
      interaction.member?.user?.username || interaction.user.username
    );
    await ratService.updateParticipant(participant.id, { wishlistUrl });
    await interaction.reply({ content: 'Your wishlist has been saved!', ephemeral: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save wishlist.';
    await interaction.reply({ content: msg, ephemeral: true });
  }
}
