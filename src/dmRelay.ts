import type { Client, Message, TextChannel } from 'discord.js';
import { repo } from './repo.js';
import { copy } from './messages.js';

export function setupDmRelay(client: Client, guildId: string) {
  client.on('messageCreate', async (msg: Message) => {
    if (msg.author.bot) return;
    if (msg.guild) return; // only DMs
    const ev = repo.getActiveEvent(guildId);
    if (!ev) return;
    const recipientId = repo.getRecipientForGiver(ev.id, msg.author.id);
    if (!recipientId) return;
    try {
      const user = await client.users.fetch(recipientId);
      await user.send(`Anonymous Ratmas Santa says: ${msg.content}`);
    } catch {
      const settings = repo.getGuildSettings(guildId);
      if (!settings.announcements_channel_id) return;
      const ch = client.channels.cache.get(settings.announcements_channel_id) as
        | TextChannel
        | undefined;
      if (!ch) return;
      await ch.send(copy.dmDisabled(`<@${recipientId}>`));
    }
  });
}
