import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { MessageResult, MessageOptions, MessageEmbed, DMResult } from '../types/discord.types.js';

/**
 * Message management service
 * Handles sending messages to channels and DMs
 */
export class MessageService {
  constructor(private client: Client) {}

  /**
   * Send a direct message to a user
   * @param userId - The user ID to send DM to
   * @param message - The message content
   * @returns Result of the DM operation
   */
  async sendDirectMessage(userId: string, message: string): Promise<DMResult> {
    try {
      const user = await this.client.users.fetch(userId);
      if (!user) {
        return {
          success: false,
          error: `User with ID ${userId} not found`,
        };
      }

      await user.send(message);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send DM to user ${userId}:`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send a message to a text channel
   * @param channelId - The channel ID to send message to
   * @param content - The message content (string or MessageOptions)
   * @returns Result of the message send operation
   */
  async sendChannelMessage(
    channelId: string,
    content: string | MessageOptions
  ): Promise<MessageResult> {
    try {
      const channel = await this.fetchTextChannel(channelId);
      if (!channel.success) {
        return { success: false, error: channel.error };
      }

      const message =
        typeof content === 'string'
          ? await channel.channel!.send(content)
          : await channel.channel!.send(this.buildMessagePayload(content));

      return { success: true, messageId: message.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send message to channel ${channelId}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Send a simple text message to a channel
   * @param channelId - The channel ID
   * @param message - The text message
   * @returns Result of the message send operation
   */
  async sendTextMessage(channelId: string, message: string): Promise<MessageResult> {
    return this.sendChannelMessage(channelId, message);
  }

  /**
   * Send an embed message to a channel
   * @param channelId - The channel ID
   * @param embed - The embed to send
   * @returns Result of the message send operation
   */
  async sendEmbed(channelId: string, embed: MessageEmbed): Promise<MessageResult> {
    return this.sendChannelMessage(channelId, { embeds: [embed] });
  }

  /**
   * Send a message with both text and embeds
   * @param channelId - The channel ID
   * @param content - The text content
   * @param embeds - Array of embeds
   * @returns Result of the message send operation
   */
  async sendMessageWithEmbeds(
    channelId: string,
    content: string,
    embeds: MessageEmbed[]
  ): Promise<MessageResult> {
    return this.sendChannelMessage(channelId, { content, embeds });
  }

  /**
   * Fetch and validate a text channel
   * @param channelId - The channel ID
   * @returns Result with channel or error
   */
  private async fetchTextChannel(channelId: string): Promise<{
    success: boolean;
    channel?: TextChannel;
    error?: string;
  }> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel) {
      return {
        success: false,
        error: `Channel with ID ${channelId} not found`,
      };
    }

    if (!channel.isTextBased()) {
      return {
        success: false,
        error: 'Channel is not a text-based channel',
      };
    }

    return { success: true, channel: channel as TextChannel };
  }

  /**
   * Build message payload from MessageOptions
   * @param options - Message options
   * @returns Message payload object
   */
  private buildMessagePayload(options: MessageOptions): {
    content?: string;
    embeds?: EmbedBuilder[];
    files?: string[];
  } {
    const payload: {
      content?: string;
      embeds?: EmbedBuilder[];
      files?: string[];
    } = {};

    if (options.content) {
      payload.content = options.content;
    }

    if (options.embeds && options.embeds.length > 0) {
      payload.embeds = options.embeds.map((embed) => this.buildEmbed(embed));
    }

    if (options.files && options.files.length > 0) {
      payload.files = options.files;
    }

    return payload;
  }

  /**
   * Build an EmbedBuilder from a MessageEmbed interface
   * @param embed - The embed data
   * @returns EmbedBuilder instance
   */
  private buildEmbed(embed: MessageEmbed): EmbedBuilder {
    const builder = new EmbedBuilder();

    if (embed.title) builder.setTitle(embed.title);
    if (embed.description) builder.setDescription(embed.description);
    if (embed.color !== undefined) builder.setColor(embed.color);
    if (embed.footer) {
      builder.setFooter({
        text: embed.footer.text,
        iconURL: embed.footer.iconUrl,
      });
    }
    if (embed.thumbnail) builder.setThumbnail(embed.thumbnail.url);
    if (embed.image) builder.setImage(embed.image.url);
    if (embed.timestamp) builder.setTimestamp(embed.timestamp);
    if (embed.fields && embed.fields.length > 0) {
      builder.addFields(embed.fields);
    }

    return builder;
  }
}
