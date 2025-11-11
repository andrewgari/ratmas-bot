/**
 * User profile information
 */
export interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  tag: string;
  avatarUrl: string | null;
  bot: boolean;
}

/**
 * Guild member information with profile and roles
 */
export interface MemberInfo {
  profile: UserProfile;
  nickname: string | null;
  roles: RoleInfo[];
  joinedAt: Date | null;
}

/**
 * Role information
 */
export interface RoleInfo {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
}

/**
 * Options for filtering guild members
 */
export interface MemberFilterOptions {
  roleIds?: string[];
  excludeBots?: boolean;
}

/**
 * Result of a DM send operation
 */
export interface DMResult {
  success: boolean;
  error?: string;
}

/**
 * Result of a channel message send operation
 */
export interface MessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Options for sending messages to channels
 */
export interface MessageOptions {
  content?: string;
  embeds?: MessageEmbed[];
  files?: string[];
}

/**
 * Simple embed structure for rich messages
 */
export interface MessageEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: EmbedField[];
  footer?: { text: string; iconUrl?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  timestamp?: Date;
}

/**
 * Embed field structure
 */
export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * Options for creating a text channel
 */
export interface CreateChannelOptions {
  name: string;
  topic?: string;
  categoryId?: string;
  position?: number;
  nsfw?: boolean;
  rateLimitPerUser?: number;
  permissionOverwrites?: ChannelPermissionOverwrite[];
}

/**
 * Permission overwrite for a channel
 */
export interface ChannelPermissionOverwrite {
  id: string; // Role ID or User ID
  type: 'role' | 'member';
  allow?: string[]; // Array of permission names to allow
  deny?: string[]; // Array of permission names to deny
}

/**
 * Result of channel creation
 */
export interface ChannelResult {
  success: boolean;
  channelId?: string;
  channelName?: string;
  error?: string;
}

/**
 * Options for creating a category channel
 */
export interface CreateCategoryOptions {
  name: string;
  position?: number;
  permissionOverwrites?: ChannelPermissionOverwrite[];
}

/**
 * Category information
 */
export interface CategoryInfo {
  id: string;
  name: string;
  position: number;
}
