import { Client } from 'discord.js';
import { UserProfile, MemberInfo, MemberFilterOptions } from '../types/discord.types.js';
import { mapUserToProfile, mapMemberToInfo } from '../utils/discord.mappers.js';

/**
 * User and member management service
 * Handles user profiles and guild member queries
 */
export class UserService {
  constructor(private client: Client) {}

  /**
   * Get all members in a guild, optionally filtered by roles
   * @param guildId - The guild ID to query
   * @param options - Filter options (roleIds, excludeBots)
   * @returns Array of member information
   */
  async getGuildMembers(guildId: string, options: MemberFilterOptions = {}): Promise<MemberInfo[]> {
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
        options.roleIds!.some((roleId) => member.roles.cache.has(roleId))
      );
    }

    return filteredMembers.map((member) => mapMemberToInfo(member));
  }

  /**
   * Get a specific guild member by user ID
   * @param guildId - The guild ID
   * @param userId - The user ID
   * @returns Member information
   */
  async getGuildMember(guildId: string, userId: string): Promise<MemberInfo | null> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${guildId} not found`);
      }

      const member = await guild.members.fetch(userId);
      return member ? mapMemberToInfo(member) : null;
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
      return user ? mapUserToProfile(user) : null;
    } catch (error) {
      console.error(`Failed to fetch user ${userId}:`, error);
      return null;
    }
  }
}
