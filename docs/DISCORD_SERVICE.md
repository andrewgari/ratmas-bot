# Discord Utility Service

A comprehensive Discord service layer providing a clean data access layer (DAL) for interacting with Discord's API.

## Features

- **Guild Member Queries**: Fetch all members or filter by roles
- **User Profile Information**: Get detailed user profiles including avatars and roles
- **Role Management**: Query guild roles and member role assignments
- **Direct Messaging**: Send DMs to users with error handling
- **Channel Messaging**: Post text messages and rich embeds to text channels
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
  'Hello! This is a DM from the bot.'
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

### Post Text Message to Channel

```typescript
// Simple text message
const result = await discordService.sendTextMessage('channel-id', 'Hello from the bot!');

if (result.success) {
  console.log(`Message posted with ID: ${result.messageId}`);
}
```

### Post Embed to Channel

```typescript
// Rich embed message
const result = await discordService.sendEmbed('channel-id', {
  title: 'Server Status',
  description: 'All systems operational',
  color: 0x00ff00, // Green
  fields: [
    { name: 'Users Online', value: '42', inline: true },
    { name: 'CPU Usage', value: '23%', inline: true },
  ],
  footer: { text: 'Status Bot' },
  timestamp: true,
});
```

### Post Complex Message with Multiple Embeds

```typescript
// Message with both text and multiple embeds
const result = await discordService.sendMessageWithEmbeds('channel-id', 'Daily Report:', [
  {
    title: 'Statistics',
    color: 0x0099ff,
    fields: [
      { name: 'New Members', value: '15', inline: true },
      { name: 'Messages', value: '1,234', inline: true },
    ],
  },
  {
    title: 'Top Contributors',
    color: 0xffaa00,
    description: '1. User1\n2. User2\n3. User3',
  },
]);
```

### Advanced Channel Message with Options

```typescript
// Full control with MessageOptions
const result = await discordService.sendChannelMessage('channel-id', {
  content: 'Check out this announcement:',
  embeds: [
    {
      title: '🎉 New Feature Released!',
      description: 'We just launched something amazing!',
      color: 0xff6600,
      thumbnail: { url: 'https://example.com/icon.png' },
      image: { url: 'https://example.com/feature.png' },
      fields: [
        { name: 'Version', value: '2.0.0', inline: true },
        { name: 'Release Date', value: 'Today', inline: true },
      ],
      footer: { text: 'Development Team', iconURL: 'https://example.com/logo.png' },
      timestamp: true,
    },
  ],
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

### MessageResult

```typescript
interface MessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
```

### MessageOptions

```typescript
interface MessageOptions {
  content?: string;
  embeds?: MessageEmbed[];
  files?: string[]; // File paths or URLs
}
```

### MessageEmbed

```typescript
interface MessageEmbed {
  title?: string;
  description?: string;
  color?: number; // Hex color as number (e.g., 0x00ff00)
  fields?: EmbedField[];
  footer?: { text: string; iconURL?: string };
  thumbnail?: { url: string };
  image?: { url: string };
  timestamp?: boolean; // If true, uses current timestamp
}

interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}
```

## Example: Bot Command Handler

```typescript
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Get member info command
  if (message.content === '!myinfo' && message.guildId) {
    const memberInfo = await discordService.getGuildMember(message.guildId, message.author.id);

    if (memberInfo) {
      const roleNames = memberInfo.roles.map((r) => r.name).join(', ');
      await message.reply(
        `**Your Info**\n` +
          `Username: ${memberInfo.profile.username}\n` +
          `Nickname: ${memberInfo.nickname || 'None'}\n` +
          `Roles: ${roleNames}\n` +
          `Joined: ${memberInfo.joinedAt?.toDateString() || 'Unknown'}`
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

  // Announce command with embed
  if (message.content.startsWith('!announce ') && message.channelId) {
    const announcement = message.content.slice('!announce '.length);

    const result = await discordService.sendEmbed(message.channelId, {
      title: '📢 Announcement',
      description: announcement,
      color: 0x00ff00,
      footer: { text: `Posted by ${message.author.username}` },
      timestamp: true,
    });

    if (result.success) {
      await message.reply('Announcement posted!');
    } else {
      await message.reply(`Failed to post: ${result.error}`);
    }
  }
});
```

## Error Handling

All service methods include error handling:

- `getGuildMembers`: Throws error if guild not found
- `getGuildMember`: Returns `null` if member not found
- `getUserProfile`: Returns `null` if user not found
- `sendDirectMessage`: Returns `DMResult` with success/error details
- `sendChannelMessage`, `sendTextMessage`, `sendEmbed`, `sendMessageWithEmbeds`: Return `MessageResult` with success/error details
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
