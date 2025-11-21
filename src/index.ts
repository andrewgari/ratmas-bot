import { Client, GatewayIntentBits, Message } from 'discord.js';
import dotenv from 'dotenv';
import { UserService } from './services/user.service.js';
import { MessageService } from './services/message.service.js';
import { ChannelService } from './services/channel.service.js';
import { RoleService } from './services/role.service.js';
import { RatService } from './services/rat.service.js';
import {
  ensureRatmasStartCommand,
  handleRatmasStartCommand,
  handleRatmasOptOutButton,
} from './commands/ratmas-start.command.js';
import { handleRatmasEndCommand } from './commands/ratmas-end.command.js';
import {
  ensureWishlistCommand,
  handleWishlistCommand,
  handleWishlistModal,
} from './commands/ratmas-wishlist.command.js';
import {
  ensurePairingsCommand,
  handlePairingsCommand,
} from './commands/ratmas-pairings.command.js';

dotenv.config();

type AppServices = {
  userService: UserService;
  messageService: MessageService;
  channelService: ChannelService;
  roleService: RoleService;
  ratService: RatService;
};

type RatmasCommandDependencies = Pick<AppServices, 'ratService' | 'channelService' | 'roleService'>;

export function main(): void {
  // eslint-disable-next-line no-console
  console.log('Ratmas Bot - Starting...');

  const client = createDiscordClient();
  const services = initializeServices(client);

  registerReadyHandler(client);
  registerGuildCreateHandler(client);
  registerInteractionHandlers(client, services);
  registerMessageHandler(client, services);

  const token = process.env['DISCORD_TOKEN'];
  if (!token) {
    console.error('ERROR: DISCORD_TOKEN not found in environment variables');
    process.exit(1);
  }

  client.login(token).catch((error: unknown) => {
    console.error('Failed to login:', error);
    process.exit(1);
  });
}

function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
    ],
  });
}

function initializeServices(client: Client): AppServices {
  const userService = new UserService(client);
  const messageService = new MessageService(client);
  const channelService = new ChannelService(client);
  const roleService = new RoleService(client);
  const ratService = new RatService(client, userService, messageService, channelService);

  return {
    userService,
    messageService,
    channelService,
    roleService,
    ratService,
  };
}

function registerReadyHandler(client: Client): void {
  client.once('ready', async () => {
    // eslint-disable-next-line no-console
    console.log(`Logged in as ${client.user?.tag}!`);
    // eslint-disable-next-line no-console
    console.log('Discord services are ready');

    try {
      const guilds = await client.guilds.fetch();
      await Promise.all(
        [...guilds.values()].map((guild) =>
          Promise.all([
            ensureRatmasStartCommand(client, guild.id),
            ensureWishlistCommand(client, guild.id),
            ensurePairingsCommand(client, guild.id),
          ])
        )
      );
    } catch (error) {
      console.error('Failed to register Ratmas commands:', error);
    }
  });
}

function registerGuildCreateHandler(client: Client): void {
  client.on('guildCreate', async (guild) => {
    try {
      await Promise.all([
        ensureRatmasStartCommand(client, guild.id),
        ensureWishlistCommand(client, guild.id),
        ensurePairingsCommand(client, guild.id),
      ]);
    } catch (error) {
      console.error(`Failed to register Ratmas commands for guild ${guild.id}:`, error);
    }
  });
}

function registerInteractionHandlers(client: Client, services: AppServices): void {
  const ratmasDependencies = getRatmasDependencies(services);

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        await handleRatmasStartCommand(interaction, ratmasDependencies);
        await handleRatmasEndCommand(interaction, ratmasDependencies);
        await handleWishlistCommand(interaction);
        await handlePairingsCommand(interaction, services.ratService);
      } else if (interaction.isModalSubmit()) {
        await handleWishlistModal(interaction, services.ratService);
      } else if (interaction.isButton()) {
        await handleRatmasOptOutButton(interaction, ratmasDependencies);
      }
    } catch (error) {
      console.error('Error handling interaction:', error);
    }
  });
}

function registerMessageHandler(client: Client, services: AppServices): void {
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    await handleCommands(message, services);
  });
}

function getRatmasDependencies(services: AppServices): RatmasCommandDependencies {
  return {
    ratService: services.ratService,
    channelService: services.channelService,
    roleService: services.roleService,
  };
}

/**
 * Handle incoming message commands
 */
async function handleCommands(message: Message, services: AppServices): Promise<void> {
  if (message.content === '!ping') {
    message.reply('Pong!');
    return;
  }

  if (message.content.startsWith('!memberinfo')) {
    await handleMemberInfoCommand(message, services.userService);
    return;
  }

  if (message.content === '!announce' && message.channelId) {
    await handleAnnounceCommand(message, services.messageService);
    return;
  }

  if (message.content.startsWith('!createchannel')) {
    await handleCreateChannelCommand(message, services.channelService);
    return;
  }

  if (message.content === '!roles' && message.guildId) {
    await handleRolesCommand(message, services.roleService);
    return;
  }
}

/**
 * Handle the memberinfo command
 */
async function handleMemberInfoCommand(message: Message, userService: UserService): Promise<void> {
  try {
    const memberInfo = await userService.getGuildMember(message.guildId!, message.author.id);
    if (memberInfo) {
      const roleNames = memberInfo.roles.map((r) => r.name).join(', ');
      message.reply(
        `**${memberInfo.profile.username}**\n` +
          `Nickname: ${memberInfo.nickname || 'None'}\n` +
          `Roles: ${roleNames}\n` +
          `Joined: ${memberInfo.joinedAt?.toDateString() || 'Unknown'}`
      );
    }
  } catch {
    message.reply('Failed to fetch member info');
  }
}

/**
 * Handle the announce command
 */
async function handleAnnounceCommand(
  message: Message,
  messageService: MessageService
): Promise<void> {
  const result = await messageService.sendEmbed(message.channelId, {
    title: '📢 Announcement',
    description: 'This is an example announcement using embeds!',
    color: 0x00ff00,
    fields: [
      { name: 'Field 1', value: 'Some important info', inline: true },
      { name: 'Field 2', value: 'More details here', inline: true },
    ],
    footer: { text: 'Posted by bot' },
    timestamp: new Date(),
  });

  if (result.success) {
    message.reply('Announcement posted!');
  } else {
    message.reply(`Failed to post: ${result.error}`);
  }
}

/**
 * Handle the createchannel command
 * Example: !createchannel test-channel [category-id] [role-id]
 */
async function handleCreateChannelCommand(
  message: Message,
  channelService: ChannelService
): Promise<void> {
  if (!message.guildId) {
    message.reply('This command must be used in a guild!');
    return;
  }

  const args = message.content.split(' ').slice(1);
  if (args.length === 0) {
    message.reply('Usage: !createchannel <name> [category-id] [role-id]');
    return;
  }

  const channelName = args[0]!;
  const categoryId = args[1];
  const roleId = args[2];

  const options = {
    name: channelName,
    categoryId,
    permissionOverwrites: roleId
      ? [
          {
            id: roleId,
            type: 'role' as const,
            allow: ['ViewChannel', 'SendMessages'],
          },
        ]
      : undefined,
  };

  const result = await channelService.createTextChannel(message.guildId, options);

  if (result.success) {
    message.reply(`Channel created: <#${result.channelId}> (${result.channelName})`);
  } else {
    message.reply(`Failed to create channel: ${result.error}`);
  }
}

/**
 * Handle the roles command
 */
async function handleRolesCommand(message: Message, roleService: RoleService): Promise<void> {
  try {
    const roles = await roleService.getGuildRoles(message.guildId!);
    const roleList = roles
      .filter((r) => r.name !== '@everyone')
      .map((r) => `${r.name} (${r.id})`)
      .join('\n');

    message.reply(`**Server Roles:**\n${roleList || 'No roles found'}`);
  } catch {
    message.reply('Failed to fetch roles');
  }
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export services for external use
export { UserService } from './services/user.service.js';
export { MessageService } from './services/message.service.js';
export { ChannelService } from './services/channel.service.js';
export { RoleService } from './services/role.service.js';
export * from './types/discord.types.js';
