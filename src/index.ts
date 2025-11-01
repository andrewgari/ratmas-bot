import { Client, GatewayIntentBits, REST, Routes, InteractionType, Partials } from 'discord.js';
import { assertConfig, config } from './config.js';
import { data as ratmasCmd, execute as ratmasExec } from './commands/ratmas.js';
import { setupDmRelay } from './dmRelay.js';
import { scheduleForActiveEvent } from './scheduler.js';
import './database.js';

async function main() {
  assertConfig();
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Channel],
  });

  client.once('ready', async () => {
    console.log('Ratmas bot ready. The rat that makes all the rules approves.');
    // Register commands to allowed guilds for fast iteration
    const rest = new REST({ version: '10' }).setToken(config.token);
    for (const gid of config.allowedGuildIds.length ? config.allowedGuildIds : [config.guildId]) {
      await rest.put(Routes.applicationGuildCommands(config.clientId, gid), {
        body: [ratmasCmd.toJSON()],
      });
    }
    scheduleForActiveEvent(client, config.guildId);
  });

  client.on('interactionCreate', async (interaction) => {
    if (interaction.type !== InteractionType.ApplicationCommand) return;
    if (!interaction.isChatInputCommand()) return;

    // Whitelist enforcement: guild + optional channel allowlists
    const guildAllowed =
      !interaction.guildId ||
      config.allowedGuildIds.length === 0 ||
      config.allowedGuildIds.includes(interaction.guildId);
    const channelAllowed =
      config.allowedChannelIds.length === 0 ||
      (interaction.channelId ? config.allowedChannelIds.includes(interaction.channelId) : true);
    if (!guildAllowed || !channelAllowed) {
      try {
        await interaction.reply({
          content: 'This bot is restricted to approved guilds/channels.',
          ephemeral: true,
        });
      } catch {}
      return;
    }

    if (interaction.commandName === 'ratmas') await ratmasExec(interaction);
  });

  setupDmRelay(client, config.guildId);
  await client.login(config.token);
}

main().catch((err) => {
  console.error('Ratmas failed to start', err);
  process.exit(1);
});
