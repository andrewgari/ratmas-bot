import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import { DiscordService } from './services/discord.service.js';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the application
 */
export function main(): void {
  // eslint-disable-next-line no-console
  console.log('Ratmas Bot - Starting...');

  // Create Discord client with necessary intents
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers, // Required for member queries
    ],
  });

  // Initialize Discord service
  const discordService = new DiscordService(client);

  // Event handler for when the bot is ready
  client.once('ready', () => {
    // eslint-disable-next-line no-console
    console.log(`Logged in as ${client.user?.tag}!`);
    // eslint-disable-next-line no-console
    console.log('Discord service is ready');
  });

  // Event handler for messages
  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    if (message.content === '!ping') {
      message.reply('Pong!');
    }

    // Example: Get member info command
    if (message.content.startsWith('!memberinfo')) {
      try {
        const memberInfo = await discordService.getGuildMember(
          message.guildId!,
          message.author.id,
        );
        if (memberInfo) {
          const roleNames = memberInfo.roles.map((r) => r.name).join(', ');
          message.reply(
            `**${memberInfo.profile.username}**\n` +
              `Nickname: ${memberInfo.nickname || 'None'}\n` +
              `Roles: ${roleNames}\n` +
              `Joined: ${memberInfo.joinedAt?.toDateString() || 'Unknown'}`,
          );
        }
      } catch {
        message.reply('Failed to fetch member info');
      }
    }
  });

  // Login to Discord
  const token = process.env['DISCORD_TOKEN'];
  if (!token) {
    console.error('ERROR: DISCORD_TOKEN not found in environment variables');
    process.exit(1);
  }

  client.login(token).catch((error) => {
    console.error('Failed to login:', error);
    process.exit(1);
  });
}

// Run if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

// Export the DiscordService for external use
export { DiscordService } from './services/discord.service.js';
export * from './types/discord.types.js';
