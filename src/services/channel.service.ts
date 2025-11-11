import {
  Client,
  ChannelType,
  PermissionFlagsBits,
  PermissionsBitField,
  OverwriteResolvable,
} from 'discord.js';
import {
  CreateChannelOptions,
  ChannelResult,
  CreateCategoryOptions,
  CategoryInfo,
  ChannelPermissionOverwrite,
} from '../types/discord.types.js';

/**
 * Discord channel management service
 * Handles channel creation and permission management
 */
export class ChannelService {
  constructor(private client: Client) {}

  /**
   * Create a category channel
   * @param guildId - The guild ID
   * @param options - Category creation options
   * @returns Result with category ID
   */
  async createCategory(
    guildId: string,
    options: CreateCategoryOptions,
  ): Promise<ChannelResult> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${guildId} not found`);
      }

      const permissionOverwrites = options.permissionOverwrites
        ? this.buildPermissionOverwrites(options.permissionOverwrites)
        : [];

      const category = await guild.channels.create({
        name: options.name,
        type: ChannelType.GuildCategory,
        position: options.position,
        permissionOverwrites,
      });

      return {
        success: true,
        channelId: category.id,
        channelName: category.name,
      };
    } catch (error) {
      return this.handleError(error, 'create category');
    }
  }

  /**
   * Create a text channel
   * @param guildId - The guild ID
   * @param options - Channel creation options
   * @returns Result with channel ID
   */
  async createTextChannel(
    guildId: string,
    options: CreateChannelOptions,
  ): Promise<ChannelResult> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${guildId} not found`);
      }

      const permissionOverwrites = options.permissionOverwrites
        ? this.buildPermissionOverwrites(options.permissionOverwrites)
        : [];

      const channel = await guild.channels.create({
        name: options.name,
        type: ChannelType.GuildText,
        topic: options.topic,
        parent: options.categoryId,
        position: options.position,
        nsfw: options.nsfw,
        rateLimitPerUser: options.rateLimitPerUser,
        permissionOverwrites,
      });

      return {
        success: true,
        channelId: channel.id,
        channelName: channel.name,
      };
    } catch (error) {
      return this.handleError(error, 'create text channel');
    }
  }

  /**
   * Set permissions for a role in a channel
   * @param channelId - The channel ID
   * @param roleId - The role ID
   * @param allow - Permissions to allow
   * @param deny - Permissions to deny
   * @returns Success result
   */
  async setChannelPermissions(
    channelId: string,
    roleId: string,
    allow: string[] = [],
    deny: string[] = [],
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const channel = await this.fetchChannelWithPermissions(channelId);
      const permissions = this.buildPermissions(allow, deny);
      await channel.permissionOverwrites.edit(roleId, permissions);
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to set channel permissions:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Get all categories in a guild
   * @param guildId - The guild ID
   * @returns Array of category information
   */
  async getCategories(guildId: string): Promise<CategoryInfo[]> {
    const guild = await this.client.guilds.fetch(guildId);
    if (!guild) {
      throw new Error(`Guild with ID ${guildId} not found`);
    }

    const channels = await guild.channels.fetch();
    const categories = channels.filter(
      (ch) => ch?.type === ChannelType.GuildCategory,
    );

    return Array.from(categories.values()).map((cat) => ({
      id: cat!.id,
      name: cat!.name,
      position: cat!.position,
    }));
  }

  /**
   * Fetch channel and validate it supports permissions
   */
  private async fetchChannelWithPermissions(
    channelId: string,
  ): Promise<{
    permissionOverwrites: {
      edit: (
        roleId: string,
        permissions: Record<string, boolean | null>,
      ) => Promise<unknown>;
    };
  }> {
    const channel = await this.client.channels.fetch(channelId);
    if (!channel) {
      throw new Error(`Channel with ID ${channelId} not found`);
    }

    if (!('permissionOverwrites' in channel)) {
      throw new Error('Channel does not support permission overwrites');
    }

    return channel;
  }

  /**
   * Build permissions object from allow/deny arrays
   */
  private buildPermissions(
    allow: string[],
    deny: string[],
  ): Record<string, boolean | null> {
    const permissions: Record<string, boolean | null> = {};

    for (const perm of allow) {
      const bit = this.getPermissionBit(perm);
      if (bit !== null) permissions[bit.toString()] = true;
    }

    for (const perm of deny) {
      const bit = this.getPermissionBit(perm);
      if (bit !== null) permissions[bit.toString()] = false;
    }

    return permissions;
  }

  /**
   * Build permission overwrites from simplified format
   */
  private buildPermissionOverwrites(
    overwrites: ChannelPermissionOverwrite[],
  ): OverwriteResolvable[] {
    return overwrites.map((ow) => ({
      id: ow.id,
      type: ow.type === 'role' ? 0 : 1,
      allow: ow.allow ? this.parsePermissions(ow.allow) : undefined,
      deny: ow.deny ? this.parsePermissions(ow.deny) : undefined,
    }));
  }

  /**
   * Parse permission names to PermissionsBitField
   */
  private parsePermissions(permissions: string[]): PermissionsBitField {
    const bits = permissions
      .map((perm) => this.getPermissionBit(perm))
      .filter((bit) => bit !== null) as bigint[];
    return new PermissionsBitField(bits);
  }

  /**
   * Get permission bit from permission name
   */
  private getPermissionBit(permission: string): bigint | null {
    const permMap: Record<string, bigint> = {
      ViewChannel: PermissionFlagsBits.ViewChannel,
      SendMessages: PermissionFlagsBits.SendMessages,
      ReadMessageHistory: PermissionFlagsBits.ReadMessageHistory,
      ManageMessages: PermissionFlagsBits.ManageMessages,
      EmbedLinks: PermissionFlagsBits.EmbedLinks,
      AttachFiles: PermissionFlagsBits.AttachFiles,
      AddReactions: PermissionFlagsBits.AddReactions,
      UseExternalEmojis: PermissionFlagsBits.UseExternalEmojis,
      MentionEveryone: PermissionFlagsBits.MentionEveryone,
      ManageChannels: PermissionFlagsBits.ManageChannels,
      ManageRoles: PermissionFlagsBits.ManageRoles,
      Connect: PermissionFlagsBits.Connect,
      Speak: PermissionFlagsBits.Speak,
    };
    return permMap[permission] ?? null;
  }

  /**
   * Handle errors consistently
   */
  private handleError(error: unknown, operation: string): ChannelResult {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to ${operation}:`, error);
    return { success: false, error: errorMessage };
  }
}
