import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChannelType } from 'discord.js';
import {
  handleRatmasStartCommand,
  RATMAS_COMMAND_NAME,
} from '../../src/commands/ratmas-start.command.js';
import { RatService } from '../../src/services/rat.service.js';
import { ChannelService } from '../../src/services/channel.service.js';
import { RoleService } from '../../src/services/role.service.js';

describe('ratmas-start command integration', () => {
  const ratServiceMocks = {
    getActiveEvent: jest.fn(),
    createEvent: jest.fn(),
  };
  const channelServiceMocks = {
    createTextChannel: jest.fn(),
    setChannelPermissions: jest.fn(),
  };
  const roleServiceMocks = {};

  const deps = {
    ratService: ratServiceMocks as unknown as RatService,
    channelService: channelServiceMocks as unknown as ChannelService,
    roleService: roleServiceMocks as unknown as RoleService,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env['RATMAS_ROLE_ID'] = 'rat-role';
    ratServiceMocks.getActiveEvent.mockImplementation(async () => null);
    channelServiceMocks.createTextChannel.mockImplementation(async () => ({
      success: true,
      channelId: 'ratmas-channel-id',
      channelName: 'ratmas-2025',
    }));
  });

  it('creates a Ratmas event when the admin invokes /ratmas start with date options', async () => {
    const send = jest.fn();
    channelServiceMocks.setChannelPermissions.mockImplementation(async () => ({ success: true }));

    type MinimalChannel = { id: string; name: string; type: ChannelType };
    const guildChannels = new Map<string, MinimalChannel>();
    const client = {
      guilds: {
        fetch: jest.fn(async () => ({
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
        })),
      },
      channels: {
        fetch: jest.fn(async () => ({
          id: 'ratmas-channel-id',
          type: ChannelType.GuildText,
          send,
        })),
      },
    };

    const interaction = {
      commandName: RATMAS_COMMAND_NAME,
      options: {
        getSubcommand: () => 'start',
        getString: (name: string) => {
          const values: Record<string, string> = {
            timezone: 'UTC',
            start_date: '2025-12-01',
            end_date: '2025-12-26',
            reveal_date: '2025-12-26',
            purchase_deadline: '2025-12-16',
          };
          return values[name];
        },
      },
      guildId: 'guild-123',
      memberPermissions: { has: () => true },
      client,
      reply: jest.fn(),
    } as unknown as Parameters<typeof handleRatmasStartCommand>[0];

    await handleRatmasStartCommand(interaction, deps);

    expect(channelServiceMocks.createTextChannel).toHaveBeenCalledWith('guild-123', {
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

    expect(ratServiceMocks.createEvent).toHaveBeenCalledTimes(1);
    const eventPayload = ratServiceMocks.createEvent.mock.calls[0]?.[0] as {
      eventStartDate: Date;
      eventEndDate: Date;
      revealDate: Date;
      purchaseDeadline: Date;
    };
    expect(eventPayload).toMatchObject({
      guildId: 'guild-123',
      ratmasRoleId: 'rat-role',
      announcementChannelId: 'ratmas-channel-id',
    });
    expect(eventPayload.eventStartDate.toISOString()).toBe('2025-12-01T00:00:00.000Z');
    expect(eventPayload.eventEndDate.toISOString()).toBe('2025-12-26T23:59:59.999Z');
    expect(eventPayload.revealDate.toISOString()).toBe('2025-12-26T00:00:00.000Z');
    expect(eventPayload.purchaseDeadline.toISOString()).toBe('2025-12-16T23:59:59.999Z');

    expect(send).toHaveBeenCalled();
    const message = send.mock.calls[0]?.[0] as { content: string };
    expect(message?.content).toContain('Ratmas 2025 has begun');

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Ratmas 2025 is live in <#ratmas-channel-id>!',
      ephemeral: true,
    });
  });
});
