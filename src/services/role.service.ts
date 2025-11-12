import { Client } from 'discord.js';
import { RoleInfo } from '../types/discord.types.js';
import { mapRoleToInfo } from '../utils/discord.mappers.js';

/**
 * Role management service
 * Handles role queries and operations
 */
export class RoleService {
  constructor(private client: Client) {}

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
    return Array.from(roles.values()).map((role) => mapRoleToInfo(role));
  }

  /**
   * Get a specific role by ID
   * @param guildId - The guild ID
   * @param roleId - The role ID
   * @returns Role information or null if not found
   */
  async getRole(guildId: string, roleId: string): Promise<RoleInfo | null> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${guildId} not found`);
      }

      const role = await guild.roles.fetch(roleId);
      return role ? mapRoleToInfo(role) : null;
    } catch (error) {
      console.error(`Failed to fetch role ${roleId} from guild ${guildId}:`, error);
      return null;
    }
  }

  /**
   * Remove a role from a guild member
   */
  async removeRoleFromMember(guildId: string, userId: string, roleId: string): Promise<boolean> {
    try {
      const guild = await this.client.guilds.fetch(guildId);
      if (!guild) {
        throw new Error(`Guild with ID ${guildId} not found`);
      }

      const member = await guild.members.fetch(userId);
      if (!member) {
        return false;
      }

      if (!member.roles.cache.has(roleId)) {
        return false;
      }

      await member.roles.remove(roleId);
      return true;
    } catch (error) {
      console.error(
        `Failed to remove role ${roleId} from user ${userId} in guild ${guildId}:`,
        error
      );
      return false;
    }
  }
}
