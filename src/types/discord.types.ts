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
