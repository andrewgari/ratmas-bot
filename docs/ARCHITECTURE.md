# Service Architecture

This document describes the refactored service architecture of the Ratmas Discord Bot, which follows the Single Responsibility Principle and best practices for maintainable code.

## Architecture Overview

The bot is organized into specialized services, each handling a specific domain of Discord functionality:

```
src/
├── services/
│   ├── user.service.ts       # User and member management
│   ├── message.service.ts    # Message and DM operations
│   ├── channel.service.ts    # Channel creation and management
│   └── role.service.ts       # Role queries and operations
├── utils/
│   └── discord.mappers.ts    # Data mapping utilities
└── types/
    └── discord.types.ts      # TypeScript interfaces
```

## Services

### 1. UserService

**Purpose**: Manage users and guild members

**Responsibilities**:

- Query guild members with filtering options
- Fetch specific member information
- Retrieve user profiles

**Methods**:

- `getGuildMembers(guildId, options)` - Get all members, optionally filtered
- `getGuildMember(guildId, userId)` - Get specific member info
- `getUserProfile(userId)` - Get user profile

**Example**:

```typescript
const userService = new UserService(client);

// Get all non-bot members with a specific role
const members = await userService.getGuildMembers(guildId, {
  roleIds: ['admin-role-id'],
  excludeBots: true,
});

// Get specific member
const member = await userService.getGuildMember(guildId, userId);
```

---

### 2. MessageService

**Purpose**: Handle message sending to channels and users

**Responsibilities**:

- Send direct messages
- Send channel messages (text and embeds)
- Build and format embeds

**Methods**:

- `sendDirectMessage(userId, message)` - Send DM to user
- `sendChannelMessage(channelId, content)` - Send message to channel
- `sendTextMessage(channelId, message)` - Send simple text
- `sendEmbed(channelId, embed)` - Send embed message
- `sendMessageWithEmbeds(channelId, content, embeds)` - Send text with embeds

**Example**:

```typescript
const messageService = new MessageService(client);

// Send DM
await messageService.sendDirectMessage(userId, 'Hello!');

// Send embed to channel
await messageService.sendEmbed(channelId, {
  title: 'Announcement',
  description: 'Important update',
  color: 0x00ff00,
});
```

---

### 3. ChannelService

**Purpose**: Create and manage Discord channels

**Responsibilities**:

- Create text channels and categories
- Set channel permissions
- Query categories

**Methods**:

- `createTextChannel(guildId, options)` - Create text channel
- `createCategory(guildId, options)` - Create category
- `setChannelPermissions(channelId, roleId, allow, deny)` - Set permissions
- `getCategories(guildId)` - List all categories

**Example**:

```typescript
const channelService = new ChannelService(client);

// Create category
const category = await channelService.createCategory(guildId, {
  name: 'Team Channels',
});

// Create channel with permissions
await channelService.createTextChannel(guildId, {
  name: 'private-chat',
  categoryId: category.channelId,
  permissionOverwrites: [
    {
      id: roleId,
      type: 'role',
      allow: ['ViewChannel', 'SendMessages'],
    },
  ],
});
```

---

### 4. RoleService

**Purpose**: Query and manage server roles

**Responsibilities**:

- List guild roles
- Fetch specific role information

**Methods**:

- `getGuildRoles(guildId)` - Get all roles in guild
- `getRole(guildId, roleId)` - Get specific role info

**Example**:

```typescript
const roleService = new RoleService(client);

// Get all roles
const roles = await roleService.getGuildRoles(guildId);

// Get specific role
const adminRole = await roleService.getRole(guildId, roleId);
```

---

## Utilities

### discord.mappers.ts

**Purpose**: Centralized data mapping between Discord.js objects and application interfaces

**Functions**:

- `mapUserToProfile(user)` - Convert User to UserProfile
- `mapMemberToInfo(member)` - Convert GuildMember to MemberInfo
- `mapRoleToInfo(role)` - Convert Role to RoleInfo

**Benefits**:

- Single source of truth for data transformations
- Reusable across services
- Easy to test and maintain

---

## Design Principles

### 1. Single Responsibility Principle (SRP)

Each service has one clearly defined responsibility:

- UserService → Users and members
- MessageService → Messaging
- ChannelService → Channels
- RoleService → Roles

### 2. Dependency Injection

All services receive the Discord client through constructor injection:

```typescript
constructor(private client: Client) {}
```

This makes services:

- Easy to test (mock the client)
- Loosely coupled
- Flexible and reusable

### 3. Separation of Concerns

- **Services**: Business logic and Discord API interactions
- **Mappers**: Data transformation
- **Types**: Type definitions
- **Index**: Application initialization and command routing

### 4. Type Safety

All services use TypeScript interfaces for:

- Input parameters
- Return types
- Internal data structures

### 5. Error Handling

Consistent error handling across services:

- Try-catch blocks for async operations
- Descriptive error messages
- Graceful degradation

---

## Usage in Main Application

```typescript
// Initialize client
const client = new Client({ intents: [...] });

// Create service instances
const userService = new UserService(client);
const messageService = new MessageService(client);
const channelService = new ChannelService(client);
const roleService = new RoleService(client);

// Use in command handlers
client.on('messageCreate', async (message) => {
  if (message.content === '!memberinfo') {
    const member = await userService.getGuildMember(
      message.guildId,
      message.author.id
    );

    await messageService.sendEmbed(message.channelId, {
      title: 'Member Info',
      description: `Username: ${member.profile.username}`,
    });
  }
});
```

---

## Benefits of This Architecture

### 1. **Maintainability**

- Each service is small and focused
- Easy to locate and fix bugs
- Clear ownership of features

### 2. **Testability**

- Services can be tested in isolation
- Mock dependencies easily
- Unit tests are simpler

### 3. **Scalability**

- Easy to add new services
- Extend existing services without affecting others
- Clear patterns to follow

### 4. **Readability**

- Clear file and service names
- Logical organization
- Self-documenting structure

### 5. **Reusability**

- Services can be used in different contexts
- Mappers are shared utilities
- Types are consistent across services

---

## Migration from Old Architecture

### Before (Monolithic DiscordService):

```typescript
import { DiscordService } from './services/discord.service.js';

const service = new DiscordService(client);
await service.getGuildMembers(guildId);
await service.sendDirectMessage(userId, message);
await service.createTextChannel(guildId, options);
```

### After (Specialized Services):

```typescript
import { UserService } from './services/user.service.js';
import { MessageService } from './services/message.service.js';
import { ChannelService } from './services/channel.service.js';

const userService = new UserService(client);
const messageService = new MessageService(client);
const channelService = new ChannelService(client);

await userService.getGuildMembers(guildId);
await messageService.sendDirectMessage(userId, message);
await channelService.createTextChannel(guildId, options);
```

---

## Adding New Features

### Example: Adding a new method to UserService

1. **Define types** (if needed) in `src/types/discord.types.ts`
2. **Add method** to appropriate service
3. **Add mapper** if needed in `src/utils/discord.mappers.ts`
4. **Update documentation**
5. **Write tests**

```typescript
// In user.service.ts
async kickMember(guildId: string, userId: string): Promise<boolean> {
  try {
    const guild = await this.client.guilds.fetch(guildId);
    const member = await guild.members.fetch(userId);
    await member.kick();
    return true;
  } catch (error) {
    console.error('Failed to kick member:', error);
    return false;
  }
}
```

---

## Testing Strategy

Each service should have:

- Unit tests for each public method
- Mock Discord client
- Test error scenarios
- Test data mapping

Example test structure:

```typescript
describe('UserService', () => {
  let userService: UserService;
  let mockClient: MockClient;

  beforeEach(() => {
    mockClient = createMockClient();
    userService = new UserService(mockClient);
  });

  describe('getGuildMembers', () => {
    it('should return all members', async () => {
      // Test implementation
    });

    it('should filter by role', async () => {
      // Test implementation
    });
  });
});
```

---

## Future Enhancements

Potential additional services:

- **GuildService**: Guild settings and configuration
- **VoiceService**: Voice channel management
- **ModerationService**: Moderation actions (ban, mute, etc.)
- **EmojiService**: Custom emoji management
- **WebhookService**: Webhook operations
- **EventService**: Event scheduling and reminders

---

## Conclusion

This architecture provides a solid foundation for building and maintaining a complex Discord bot. By following these patterns and principles, the codebase remains clean, testable, and easy to extend.
