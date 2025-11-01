import 'dotenv/config';

function parseCsv(input: string | undefined): string[] {
  return (input ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  token: process.env.DISCORD_TOKEN ?? '',
  clientId: process.env.CLIENT_ID ?? '',
  guildId: process.env.GUILD_ID ?? '', // primary/active guild for this environment
  stagingGuildId: process.env.STAGING_GUILD_ID ?? '',
  allowedGuildIds: [] as string[],
  allowedChannelIds: [] as string[],
  dataDir: new URL('../data/', import.meta.url),
};

// Initialize allowlists (computed once at module load)
config.allowedGuildIds = (() => {
  const explicit = parseCsv(process.env.ALLOWED_GUILD_IDS);
  if (explicit.length) return Array.from(new Set(explicit));
  const ids = [config.guildId, config.stagingGuildId].filter(Boolean);
  return Array.from(new Set(ids));
})();

config.allowedChannelIds = Array.from(new Set(parseCsv(process.env.ALLOWED_CHANNEL_IDS)));

export function assertConfig() {
  const missing: string[] = [];
  if (!config.token) missing.push('DISCORD_TOKEN');
  if (!config.clientId) missing.push('CLIENT_ID');
  if (!config.guildId) missing.push('GUILD_ID');
  if (missing.length) throw new Error(`Missing env vars: ${missing.join(', ')}`);
}
