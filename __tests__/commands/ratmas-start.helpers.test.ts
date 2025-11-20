import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChannelType, Client } from 'discord.js';
import {
  prepareRatmasChannel,
  publishWelcomeMessage,
} from '../../src/commands/ratmas-start.helpers.js';
import { ChannelService } from '../../src/services/channel.service.js';
import { RatmasSchedule } from '../../src/utils/date.utils.js';

describe('ratmas-start helpers', () => {
  let mockClient: Client;
  let channelService: ChannelService;
  let channelServiceMocks: {
    createTextChannel: jest.Mock;
    setChannelPermissions: jest.Mock;
  };
  type MinimalChannel = { id: string; name: string; type: ChannelType };
  let guildChannels: Map<string, MinimalChannel>;
  let clientChannelsFetch: jest.Mock;
  let schedule: RatmasSchedule;

  beforeEach(() => {
    schedule = {
      eventStartDate: new Date('2025-12-01T05:00:00.000Z'),
      eventEndDate: new Date('2025-12-26T04:59:59.999Z'),
      revealDate: new Date('2025-12-26T05:00:00.000Z'),
      purchaseDeadline: new Date('2025-12-16T04:59:59.999Z'),
      timezone: 'America/New_York',
    };

    channelServiceMocks = {
      createTextChannel: jest.fn(async () => ({
        success: true,
        channelId: 'created-channel',
        channelName: 'ratmas-2025',
      })),
      setChannelPermissions: jest.fn(async () => ({ success: true })),
    };
    channelService = channelServiceMocks as unknown as ChannelService;

    guildChannels = new Map();
    const guildsFetch = jest.fn(async () => ({
      roles: { everyone: { id: 'everyone-role' } },
      channels: {
        fetch: jest.fn(async () => ({
          find: (predicate: (channel: MinimalChannel) => boolean) => {
            for (const channel of guildChannels.values()) {
              if (predicate(channel)) return channel;
            }
            return undefined;
          },
        })),
      },
    }));
    clientChannelsFetch = jest.fn();

    mockClient = {
      guilds: { fetch: guildsFetch },
      channels: { fetch: clientChannelsFetch },
    } as unknown as Client;
  });

  it('reuses an existing channel when present', async () => {
    const existingChannel = {
      id: 'existing-channel',
      name: 'ratmas-2025',
      type: ChannelType.GuildText,
    };

    guildChannels.set(existingChannel.id, existingChannel);

    const result = await prepareRatmasChannel({
      client: mockClient,
      guildId: 'guild-id',
      ratmasRoleId: 'rat-role',
      schedule,
      channelService,
    });

    expect(result).toEqual({ channelId: 'existing-channel', yearLabel: '2025' });
    expect(channelServiceMocks.createTextChannel).not.toHaveBeenCalled();
    expect(channelServiceMocks.setChannelPermissions).toHaveBeenCalledWith(
      'existing-channel',
      'everyone-role',
      [],
      ['ViewChannel']
    );
  });

  it('creates a new channel when none exists and publishes welcome message content', async () => {
    const send = jest.fn();
    clientChannelsFetch.mockImplementation(async () => ({
      id: 'created-channel',
      type: ChannelType.GuildText,
      send,
    }));

    const result = await prepareRatmasChannel({
      client: mockClient,
      guildId: 'guild-id',
      ratmasRoleId: 'rat-role',
      schedule,
      channelService,
    });

    expect(channelServiceMocks.createTextChannel).toHaveBeenCalledWith('guild-id', {
      name: 'ratmas-2025',
      permissionOverwrites: [
        { id: 'everyone-role', type: 'role', deny: ['ViewChannel'] },
        {
          id: 'rat-role',
          type: 'role',
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AddReactions'],
        },
      ],
    });
    expect(result).toEqual({ channelId: 'created-channel', yearLabel: '2025' });
  });

  it('sends a welcome message with an opt-out button', async () => {
    const send = jest.fn();
    clientChannelsFetch.mockImplementation(async () => ({
      id: 'created-channel',
      type: ChannelType.GuildText,
      send,
    }));

    await publishWelcomeMessage({
      client: mockClient,
      channelId: 'created-channel',
      schedule,
      yearLabel: '2025',
      optOutButtonId: 'opt-out',
    });

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0]?.[0] as {
      content: string;
      components: Array<{ components: Array<{ data: { custom_id: string } }> }>;
    };
    expect(payload.content).toContain('Ratmas 2025 has begun');
    expect(payload.components?.[0]?.components?.[0]?.data.custom_id).toBe('opt-out');
  });
});
