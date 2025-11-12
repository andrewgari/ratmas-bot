import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ChannelType } from 'discord.js';
import {
  handleRatmasStartCommand,
  handleRatmasStartModal,
  RATMAS_COMMAND_NAME,
  RATMAS_START_MODAL_ID,
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

  it('shows the schedule modal when the admin invokes /ratmas start', async () => {
    const showModal = jest.fn();
    const interaction = {
      commandName: RATMAS_COMMAND_NAME,
      options: { getSubcommand: () => 'start' },
      memberPermissions: { has: () => true },
      guildId: 'guild-123',
      showModal,
      client: {},
    } as unknown as Parameters<typeof handleRatmasStartCommand>[0];

    await handleRatmasStartCommand(interaction, deps);

    expect(showModal).toHaveBeenCalledTimes(1);
    const modal = showModal.mock.calls[0]?.[0] as { data?: { custom_id?: string } } | undefined;
    expect(modal?.data?.custom_id).toBe(RATMAS_START_MODAL_ID);
  });

  it('runs the full modal flow and persists the event', async () => {
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

    const fieldValues: Record<string, string> = {
      'ratmas-start-date': '2025-12-01',
      'ratmas-end-date': '2025-12-25',
      'ratmas-reveal-date': '2025-12-26',
      'ratmas-purchase-deadline': '2025-12-15',
      'ratmas-timezone': 'America/New_York',
    };

    const interaction = {
      customId: RATMAS_START_MODAL_ID,
      guildId: 'guild-123',
      memberPermissions: { has: () => true },
      client,
      fields: {
        getTextInputValue: (id: string) => fieldValues[id],
      },
      reply: jest.fn(),
    } as unknown as Parameters<typeof handleRatmasStartModal>[0];

    await handleRatmasStartModal(interaction, deps);

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
      timezone: string;
    };
    expect(eventPayload).toMatchObject({
      guildId: 'guild-123',
      ratmasRoleId: 'rat-role',
      announcementChannelId: 'ratmas-channel-id',
      timezone: 'America/New_York',
    });
    expect(eventPayload.eventStartDate.toISOString()).toBe('2025-12-01T05:00:00.000Z');
    expect(eventPayload.eventEndDate.toISOString()).toBe('2025-12-26T04:59:59.999Z');
    expect(eventPayload.revealDate.toISOString()).toBe('2025-12-26T05:00:00.000Z');
    expect(eventPayload.purchaseDeadline.toISOString()).toBe('2025-12-16T04:59:59.999Z');

    expect(send).toHaveBeenCalled();
    const message = send.mock.calls[0]?.[0] as { content: string };
    expect(message?.content).toContain('Ratmas 2025 has begun');

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Ratmas 2025 is live in <#ratmas-channel-id>!',
      ephemeral: true,
    });
  });
});
