# Discord Utility Service

A comprehensive Discord service layer providing a clean data access layer (DAL) for interacting with Discord's API.

## Features

- **Guild Member Queries**: Fetch all members or filter by roles
- **User Profile Information**: Get detailed user profiles including avatars and roles
- **Role Management**: Query guild roles and member role assignments
- **Direct Messaging**: Send DMs to users with error handling
- **Type-Safe**: Full TypeScript support with well-defined interfaces

## Installation

The service is already included in the project. Make sure you have the required dependencies:

```bash
npm install discord.js dotenv
```

## Usage

### Initialize the Service

```typescript
import { Client, GatewayIntentBits } from 'discord.js';
import { DiscordService } from './services/discord.service.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Required for member queries
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const discordService = new DiscordService(client);
```

### Get All Guild Members

```typescript
// Get all members
const allMembers = await discordService.getGuildMembers('guild-id');

// Filter by role
const adminMembers = await discordService.getGuildMembers('guild-id', {
  roleIds: ['admin-role-id'],
});

// Exclude bots
const humanMembers = await discordService.getGuildMembers('guild-id', {
  excludeBots: true,
});

// Combine filters
const humanAdmins = await discordService.getGuildMembers('guild-id', {
  roleIds: ['admin-role-id'],
  excludeBots: true,
});
```

### Get Specific Member Info

```typescript
const memberInfo = await discordService.getGuildMember('guild-id', 'user-id');

if (memberInfo) {
  console.log(`Username: ${memberInfo.profile.username}`);
  console.log(`Nickname: ${memberInfo.nickname || 'None'}`);
  console.log(`Roles: ${memberInfo.roles.map((r) => r.name).join(', ')}`);
  console.log(`Avatar: ${memberInfo.profile.avatarUrl}`);
}
```

### Get User Profile

```typescript
const userProfile = await discordService.getUserProfile('user-id');

if (userProfile) {
  console.log(`Tag: ${userProfile.tag}`);
  console.log(`Bot: ${userProfile.bot}`);
  console.log(`Avatar: ${userProfile.avatarUrl}`);
}
```

### Send Direct Message

```typescript
const result = await discordService.sendDirectMessage(
  'user-id',
  'Hello! This is a DM from the bot.',
);

if (result.success) {
  console.log('DM sent successfully!');
} else {
  console.error(`Failed to send DM: ${result.error}`);
}
```

### Get Guild Roles

```typescript
const roles = await discordService.getGuildRoles('guild-id');

roles.forEach((role) => {
  console.log(`${role.name} (${role.id}) - Position: ${role.position}`);
});
```

## Type Definitions

### UserProfile

```typescript
interface UserProfile {
  id: string;
  username: string;
  discriminator: string;
  tag: string;
  avatarUrl: string | null;
  bot: boolean;
}
```

### MemberInfo

```typescript
interface MemberInfo {
  profile: UserProfile;
  nickname: string | null;
  roles: RoleInfo[];
  joinedAt: Date | null;
}
```

### RoleInfo

```typescript
interface RoleInfo {
  id: string;
  name: string;
  color: number;
  position: number;
  permissions: string;
}
```

### MemberFilterOptions

```typescript
interface MemberFilterOptions {
  roleIds?: string[]; // Filter members by these role IDs
  excludeBots?: boolean; // Exclude bot accounts
}
```

### DMResult

```typescript
interface DMResult {
  success: boolean;
  error?: string;
}
```

## Example: Bot Command Handler

```typescript
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Get member info command
  if (message.content === '!myinfo' && message.guildId) {
    const memberInfo = await discordService.getGuildMember(
      message.guildId,
      message.author.id,
    );

    if (memberInfo) {
      const roleNames = memberInfo.roles.map((r) => r.name).join(', ');
      await message.reply(
        `**Your Info**\n` +
          `Username: ${memberInfo.profile.username}\n` +
          `Nickname: ${memberInfo.nickname || 'None'}\n` +
          `Roles: ${roleNames}\n` +
          `Joined: ${memberInfo.joinedAt?.toDateString() || 'Unknown'}`,
      );
    }
  }

  // List admins command
  if (message.content === '!admins' && message.guildId) {
    const adminRole = '123456789'; // Your admin role ID
    const admins = await discordService.getGuildMembers(message.guildId, {
      roleIds: [adminRole],
      excludeBots: true,
    });

    const adminList = admins.map((m) => m.profile.username).join(', ');
    await message.reply(`Admins: ${adminList}`);
  }
});
```

## Error Handling

All service methods include error handling:

- `getGuildMembers`: Throws error if guild not found
- `getGuildMember`: Returns `null` if member not found
- `getUserProfile`: Returns `null` if user not found
- `sendDirectMessage`: Returns `DMResult` with success/error details
- `getGuildRoles`: Throws error if guild not found

## Required Discord Bot Permissions

Make sure your bot has these permissions:

- `GUILDS` - Read guild information
- `GUILD_MEMBERS` - Access member data (requires privileged intent)
- `SEND_MESSAGES` - Send messages in channels
- `VIEW_CHANNEL` - See channels

## Notes

- The `GuildMembers` intent is a privileged intent and must be enabled in the Discord Developer Portal
- Some methods may return `null` if the requested resource doesn't exist
- Avatar URLs are returned at 256px size by default
- Role permissions are returned as bigint strings

## Contributing

To extend the service with additional functionality, add new methods to the `DiscordService` class and update the type definitions accordingly.
