import { Client, GuildMember } from 'discord.js';
import {
  UserProfile,
  MemberInfo,
  RoleInfo,
  MemberFilterOptions,
  DMResult,
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
