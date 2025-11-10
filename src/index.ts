import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Main entry point for the application
 */
export function main(): void {
  // eslint-disable-next-line no-console
  console.log('Ratmas Bot - Starting...');

  // Create Discord client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  // Event handler for when the bot is ready
  client.once('ready', () => {
    // eslint-disable-next-line no-console
    console.log(`Logged in as ${client.user?.tag}!`);
  });

  // Event handler for messages
  client.on('messageCreate', (message) => {
    if (message.author.bot) return;
    
    if (message.content === '!ping') {
      message.reply('Pong!');
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
