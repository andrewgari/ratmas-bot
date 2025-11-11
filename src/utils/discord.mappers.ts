import { GuildMember } from 'discord.js';
import { UserProfile, MemberInfo, RoleInfo } from '../types/discord.types.js';

/**
 * Map a User to UserProfile
 */
export function mapUserToProfile(user: {
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
 * Map a GuildMember to MemberInfo
 */
export function mapMemberToInfo(member: GuildMember): MemberInfo {
  return {
    profile: mapUserToProfile(member.user),
    nickname: member.nickname,
    roles: Array.from(member.roles.cache.values()).map((role) =>
      mapRoleToInfo(role),
    ),
    joinedAt: member.joinedAt,
  };
}

/**
 * Map a Role to RoleInfo
 */
export function mapRoleToInfo(role: {
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
