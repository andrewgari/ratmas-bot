import { Client, GuildMember, EmbedBuilder, TextChannel } from 'discord.js';
import {
  UserProfile,
  MemberInfo,
  RoleInfo,
  MemberFilterOptions,
  DMResult,
  MessageResult,
  MessageOptions,
  MessageEmbed,
} from '../types/discord.types.js';

/**
 * Discord service for querying and interacting with Discord API
 * Provides a data access layer for guild members, users, roles, and DMs
 */
export class DiscordService {
  constructor(private client: Client) {}

  /**
   * Get all members in a guild, optionally filtered by roles
   * @param guildId - The guild ID to query
   * @param options - Filter options (roleIds, excludeBots)
   * @returns Array of member information
   */
  async getGuildMembers(
    guildId: string,
    options: MemberFilterOptions = {},
  ): Promise<MemberInfo[]> {
    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new Error(`Guild with ID ${guildId} not found`);
    }

    // Fetch all members
    const members = await guild.members.fetch();

    // Filter members based on options
    let filteredMembers = Array.from(members.values());

    if (options.excludeBots) {
      filteredMembers = filteredMembers.filter((member) => !member.user.bot);
    }

    if (options.roleIds && options.roleIds.length > 0) {
      filteredMembers = filteredMembers.filter((member) =>
        options.roleIds!.some((roleId) => member.roles.cache.has(roleId)),
      );
    }

    return filteredMembers.map((member) => this.mapMemberToInfo(member));
  }

  /**
   * Get a specific guild member by user ID
   * @param guildId - The guild ID
   * @param userId - The user ID
   * @returns Member information
   */
  async getGuildMember(
    guildId: string,
    userId: string,
  ): Promise<MemberInfo | null> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${guildId} not found`);
      }

      const member = await guild.members.fetch(userId);
      return member ? this.mapMemberToInfo(member) : null;
    } catch (error) {
      console.error(`Failed to fetch member ${userId} from guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Get user profile information
   * @param userId - The user ID
   * @returns User profile information
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const user = await this.client.users.fetch(userId);
      return user ? this.mapUserToProfile(user) : null;
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error);
      return null;
    }
  }

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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send DM to user ${userId}:`, error);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get all roles in a guild
   * @param guildId - The guild ID
   * @returns Array of role information
   */
  async getGuildRoles(guildId: string): Promise<RoleInfo[]> {
    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new Error(`Guild with ID ${guildId} not found`);
    }

    const roles = await guild.roles.fetch();
    return Array.from(roles.values()).map((role) => this.mapRoleToInfo(role));
  }

  /**
   * Send a message to a text channel
   * @param channelId - The channel ID to send message to
   * @param content - The message content (string or MessageOptions)
   * @returns Result of the message send operation
   */
  async sendChannelMessage(
    channelId: string,
    content: string | MessageOptions,
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
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send message to channel ${channelId}:`, error);
      return { success: false, error: errorMessage };
    }
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
   * Send a simple text message to a channel
   * @param channelId - The channel ID
   * @param message - The text message
   * @returns Result of the message send operation
   */
  async sendTextMessage(
    channelId: string,
    message: string,
  ): Promise<MessageResult> {
    return this.sendChannelMessage(channelId, message);
  }

  /**
   * Send an embed message to a channel
   * @param channelId - The channel ID
   * @param embed - The embed to send
   * @returns Result of the message send operation
   */
  async sendEmbed(
    channelId: string,
    embed: MessageEmbed,
  ): Promise<MessageResult> {
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
    embeds: MessageEmbed[],
  ): Promise<MessageResult> {
    return this.sendChannelMessage(channelId, { content, embeds });
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

  /**
   * Map a GuildMember to MemberInfo
   */
  private mapMemberToInfo(member: GuildMember): MemberInfo {
    return {
      profile: this.mapUserToProfile(member.user),
      nickname: member.nickname,
      roles: Array.from(member.roles.cache.values()).map((role) =>
        this.mapRoleToInfo(role),
      ),
      joinedAt: member.joinedAt,
    };
  }

  /**
   * Map a User to UserProfile
   */
  private mapUserToProfile(user: {
    id: string;
    username: string;
    discriminator: string;
    tag: string;
    bot: boolean;
    displayAvatarURL: (options?: { size?: number }) => string;
  }): UserProfile {
    return {
      id: user.id,
      username: user.username,
      discriminator: user.discriminator,
      tag: user.tag,
      avatarUrl: user.displayAvatarURL({ size: 256 }),
      bot: user.bot,
    };
  }

  /**
   * Map a Role to RoleInfo
   */
  private mapRoleToInfo(role: {
    id: string;
    name: string;
    color: number;
    position: number;
    permissions: { bitfield: bigint };
  }): RoleInfo {
    return {
      id: role.id,
      name: role.name,
      color: role.color,
      position: role.position,
      permissions: role.permissions.bitfield.toString(),
    };
  }
}
