# Channel Service Documentation

The `ChannelService` provides comprehensive functionality for creating and managing Discord channels, including text channels, categories, and permission management.

## Features

- **Create Categories**: Organize channels into category groups
- **Create Text Channels**: Create new text channels with customizable settings
- **Permission Management**: Set role-based permissions for channels
- **List Categories**: Retrieve all categories in a guild
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
import { ChannelService } from './services/channel.service.js';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const channelService = new ChannelService(client);
```

### Create a Category

```typescript
const result = await channelService.createCategory('guild-id', {
  name: 'Team Channels',
  position: 0,
  permissionOverwrites: [
    {
      id: 'role-id',
      type: 'role',
      allow: ['ViewChannel'],
      deny: ['SendMessages'],
    },
  ],
});

if (result.success) {
  console.log(`Category created: ${result.channelId}`);
}
```

### Create a Text Channel

```typescript
// Simple text channel
const result = await channelService.createTextChannel('guild-id', {
  name: 'general-chat',
  topic: 'General discussion',
});

// Channel with category
const result = await channelService.createTextChannel('guild-id', {
  name: 'announcements',
  topic: 'Important announcements',
  categoryId: 'category-id',
  position: 0,
});

// Channel with permissions
const result = await channelService.createTextChannel('guild-id', {
  name: 'private-chat',
  categoryId: 'category-id',
  permissionOverwrites: [
    {
      id: 'admin-role-id',
      type: 'role',
      allow: ['ViewChannel', 'SendMessages', 'ManageMessages'],
    },
    {
      id: 'everyone-role-id',
      type: 'role',
      deny: ['ViewChannel'],
    },
  ],
});
```

### Create a Channel with Rate Limiting

```typescript
const result = await channelService.createTextChannel('guild-id', {
  name: 'slow-mode-channel',
  rateLimitPerUser: 10, // 10 seconds between messages
  topic: 'Please think before posting',
});
```

### Create an NSFW Channel

```typescript
const result = await channelService.createTextChannel('guild-id', {
  name: 'nsfw-content',
  nsfw: true,
  categoryId: 'adult-category-id',
});
```

### Set Channel Permissions

```typescript
// Allow a role to view and send messages
await channelService.setChannelPermissions(
  'channel-id',
  'role-id',
  ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
  [],
);

// Deny a role from viewing a channel
await channelService.setChannelPermissions(
  'channel-id',
  'muted-role-id',
  [],
  ['SendMessages', 'AddReactions'],
);

// Mixed permissions
await channelService.setChannelPermissions(
  'channel-id',
  'mod-role-id',
  ['ViewChannel', 'SendMessages', 'ManageMessages', 'ReadMessageHistory'],
  ['MentionEveryone'],
);
```

### Get All Categories

```typescript
const categories = await channelService.getCategories('guild-id');

categories.forEach((category) => {
  console.log(`${category.name} (Position: ${category.position})`);
});
```

## Type Definitions

### CreateCategoryOptions

```typescript
interface CreateCategoryOptions {
  name: string;
  position?: number;
  permissionOverwrites?: ChannelPermissionOverwrite[];
}
```

### CreateChannelOptions

```typescript
interface CreateChannelOptions {
  name: string;
  topic?: string;
  categoryId?: string;
  position?: number;
  nsfw?: boolean;
  rateLimitPerUser?: number; // In seconds (0-21600)
  permissionOverwrites?: ChannelPermissionOverwrite[];
}
```

### ChannelPermissionOverwrite

```typescript
interface ChannelPermissionOverwrite {
  id: string; // Role ID or User ID
  type: 'role' | 'member';
  allow?: string[]; // Array of permission names to allow
  deny?: string[]; // Array of permission names to deny
}
```

### ChannelResult

```typescript
interface ChannelResult {
  success: boolean;
  channelId?: string;
  channelName?: string;
  error?: string;
}
```

### CategoryInfo

```typescript
interface CategoryInfo {
  id: string;
  name: string;
  position: number;
}
```

## Available Permissions

The following permission names can be used in `allow` and `deny` arrays:

- `ViewChannel` - View channels
- `SendMessages` - Send messages in text channels
- `ReadMessageHistory` - Read message history
- `ManageMessages` - Delete and pin messages
- `EmbedLinks` - Links sent will show embeds
- `AttachFiles` - Attach files and media
- `AddReactions` - Add reactions to messages
- `UseExternalEmojis` - Use external emojis
- `MentionEveryone` - Mention @everyone, @here, and all roles
- `ManageChannels` - Manage channels (edit settings, delete)
- `ManageRoles` - Manage permissions
- `Connect` - Connect to voice channels
- `Speak` - Speak in voice channels

## Example: Bot Command Handler

```typescript
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guildId) return;

  // Create channel command
  if (message.content.startsWith('!createchannel')) {
    const args = message.content.split(' ').slice(1);
    if (args.length === 0) {
      message.reply('Usage: !createchannel <name> [category-id] [role-id]');
      return;
    }

    const result = await channelService.createTextChannel(message.guildId, {
      name: args[0],
      categoryId: args[1],
      permissionOverwrites: args[2]
        ? [
            {
              id: args[2],
              type: 'role',
              allow: ['ViewChannel', 'SendMessages'],
            },
          ]
        : undefined,
    });

    if (result.success) {
      message.reply(`Channel created: <#${result.channelId}>`);
    } else {
      message.reply(`Failed: ${result.error}`);
    }
  }

  // Create category command
  if (message.content.startsWith('!createcategory')) {
    const name = message.content.split(' ').slice(1).join(' ');
    if (!name) {
      message.reply('Usage: !createcategory <name>');
      return;
    }

    const result = await channelService.createCategory(message.guildId, {
      name,
    });

    if (result.success) {
      message.reply(`Category created: ${result.channelName}`);
    } else {
      message.reply(`Failed: ${result.error}`);
    }
  }

  // Lock channel command (remove send permissions from @everyone)
  if (message.content === '!lockchannel') {
    const everyoneRole = message.guild?.roles.everyone;
    if (!everyoneRole) return;

    const result = await channelService.setChannelPermissions(
      message.channelId,
      everyoneRole.id,
      [],
      ['SendMessages'],
    );

    if (result.success) {
      message.channel.send('🔒 Channel locked!');
    }
  }

  // Unlock channel command
  if (message.content === '!unlockchannel') {
    const everyoneRole = message.guild?.roles.everyone;
    if (!everyoneRole) return;

    const result = await channelService.setChannelPermissions(
      message.channelId,
      everyoneRole.id,
      ['SendMessages'],
      [],
    );

    if (result.success) {
      message.channel.send('🔓 Channel unlocked!');
    }
  }
});
```

## Error Handling

All service methods include comprehensive error handling:

- `createCategory`: Returns `ChannelResult` with success/error details
- `createTextChannel`: Returns `ChannelResult` with success/error details
- `setChannelPermissions`: Returns success/error object
- `getCategories`: Throws error if guild not found

Errors are logged to the console and returned in the result object.

## Required Discord Bot Permissions

Make sure your bot has these permissions:

- `GUILDS` - Read guild information
- `MANAGE_CHANNELS` - Create and modify channels
- `MANAGE_ROLES` - Set channel permissions
- `VIEW_CHANNEL` - See channels

## Best Practices

1. **Permission Hierarchy**: Ensure the bot's role is higher than roles you're trying to manage
2. **Rate Limiting**: Be mindful of Discord's rate limits when creating multiple channels
3. **Everyone Role**: When denying permissions to @everyone, use the guild's everyone role ID
4. **Validation**: Always check if operations succeeded before proceeding
5. **Cleanup**: Consider implementing commands to delete channels you create programmatically

## Advanced Examples

### Create a Complete Server Structure

```typescript
async function setupServerStructure(
  guildId: string,
  channelService: ChannelService,
) {
  // Create categories
  const textCategory = await channelService.createCategory(guildId, {
    name: '📝 TEXT CHANNELS',
    position: 0,
  });

  const voiceCategory = await channelService.createCategory(guildId, {
    name: '🔊 VOICE CHANNELS',
    position: 1,
  });

  if (!textCategory.success) return;

  // Create text channels in category
  await channelService.createTextChannel(guildId, {
    name: 'welcome',
    topic: 'Welcome to the server!',
    categoryId: textCategory.channelId,
    position: 0,
  });

  await channelService.createTextChannel(guildId, {
    name: 'general',
    topic: 'General discussion',
    categoryId: textCategory.channelId,
    position: 1,
  });

  await channelService.createTextChannel(guildId, {
    name: 'announcements',
    topic: 'Important announcements',
    categoryId: textCategory.channelId,
    position: 2,
    rateLimitPerUser: 60, // 1 message per minute
  });
}
```

### Create Private Channel for Specific Roles

```typescript
async function createPrivateChannel(
  guildId: string,
  channelName: string,
  allowedRoleIds: string[],
  everyoneRoleId: string,
  channelService: ChannelService,
) {
  const permissionOverwrites: ChannelPermissionOverwrite[] = [
    {
      id: everyoneRoleId,
      type: 'role',
      deny: ['ViewChannel'],
    },
    ...allowedRoleIds.map((roleId) => ({
      id: roleId,
      type: 'role' as const,
      allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
    })),
  ];

  return await channelService.createTextChannel(guildId, {
    name: channelName,
    permissionOverwrites,
  });
}
```

## Contributing

To extend the service with additional functionality, add new methods to the `ChannelService` class and update the type definitions accordingly.
