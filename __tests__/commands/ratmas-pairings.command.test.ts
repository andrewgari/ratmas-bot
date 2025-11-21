import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  handlePairingsCommand,
  RATMAS_PAIRINGS_COMMAND,
} from '../../src/commands/ratmas-pairings.command.js';
import { RatService } from '../../src/services/rat.service.js';
import { RatmasEventStatus, RatmasEvent, PairingResult } from '../../src/types/ratmas.types.js';

describe('ratmas-pairings command', () => {
  const ratServiceMocks = {
    getActiveEvent: jest.fn<() => Promise<RatmasEvent | null>>(),
    generatePairings: jest.fn<() => Promise<PairingResult>>(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('ignores interactions that are not for the pairings command', async () => {
    const reply = jest.fn();
    const interaction = {
      commandName: 'some-other-command',
      guildId: 'guild-123',
      reply,
    } as unknown as Parameters<typeof handlePairingsCommand>[0];

    await handlePairingsCommand(interaction, ratServiceMocks as unknown as RatService);

    expect(reply).not.toHaveBeenCalled();
    expect(ratServiceMocks.getActiveEvent).not.toHaveBeenCalled();
  });

  it('replies with error when not in a guild', async () => {
    const reply = jest.fn();
    const interaction = {
      commandName: RATMAS_PAIRINGS_COMMAND,
      guildId: null,
      reply,
    } as unknown as Parameters<typeof handlePairingsCommand>[0];

    await handlePairingsCommand(interaction, ratServiceMocks as unknown as RatService);

    expect(reply).toHaveBeenCalledWith({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
  });

  it('replies with error when no active event exists', async () => {
    ratServiceMocks.getActiveEvent.mockResolvedValue(null);

    const reply = jest.fn();
    const interaction = {
      commandName: RATMAS_PAIRINGS_COMMAND,
      guildId: 'guild-123',
      reply,
    } as unknown as Parameters<typeof handlePairingsCommand>[0];

    await handlePairingsCommand(interaction, ratServiceMocks as unknown as RatService);

    expect(ratServiceMocks.getActiveEvent).toHaveBeenCalledWith('guild-123');
    expect(reply).toHaveBeenCalledWith({
      content: 'No active Ratmas event.',
      ephemeral: true,
    });
  });

  it('generates pairings and replies with success when valid', async () => {
    const mockEvent = {
      id: 'event-123',
      guildId: 'guild-123',
      status: RatmasEventStatus.LOCKED,
      config: {
        ratmasRoleId: 'role-123',
        eventStartDate: new Date(),
        purchaseDeadline: new Date(),
        revealDate: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ratServiceMocks.getActiveEvent.mockResolvedValue(mockEvent);
    ratServiceMocks.generatePairings.mockResolvedValue({
      success: true,
      pairingsCreated: 5,
    });

    const reply = jest.fn();
    const interaction = {
      commandName: RATMAS_PAIRINGS_COMMAND,
      guildId: 'guild-123',
      reply,
    } as unknown as Parameters<typeof handlePairingsCommand>[0];

    await handlePairingsCommand(interaction, ratServiceMocks as unknown as RatService);

    expect(ratServiceMocks.getActiveEvent).toHaveBeenCalledWith('guild-123');
    expect(ratServiceMocks.generatePairings).toHaveBeenCalledWith('event-123');
    expect(reply).toHaveBeenCalledWith({
      content: 'Pairings complete! 5 pairs generated.',
      ephemeral: true,
    });
  });

  it('replies with error when pairing generation fails', async () => {
    const mockEvent = {
      id: 'event-123',
      guildId: 'guild-123',
      status: RatmasEventStatus.OPEN,
      config: {
        ratmasRoleId: 'role-123',
        eventStartDate: new Date(),
        purchaseDeadline: new Date(),
        revealDate: new Date(),
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    ratServiceMocks.getActiveEvent.mockResolvedValue(mockEvent);
    ratServiceMocks.generatePairings.mockResolvedValue({
      success: false,
      pairingsCreated: 0,
      error: 'Cannot generate pairings for event with status: open',
    });

    const reply = jest.fn();
    const interaction = {
      commandName: RATMAS_PAIRINGS_COMMAND,
      guildId: 'guild-123',
      reply,
    } as unknown as Parameters<typeof handlePairingsCommand>[0];

    await handlePairingsCommand(interaction, ratServiceMocks as unknown as RatService);

    expect(ratServiceMocks.getActiveEvent).toHaveBeenCalledWith('guild-123');
    expect(ratServiceMocks.generatePairings).toHaveBeenCalledWith('event-123');
    expect(reply).toHaveBeenCalledWith({
      content: 'Failed to generate pairings: Cannot generate pairings for event with status: open',
      ephemeral: true,
    });
  });

  it('handles unexpected errors gracefully', async () => {
    ratServiceMocks.getActiveEvent.mockRejectedValue(new Error('Database connection failed'));

    const reply = jest.fn();
    const interaction = {
      commandName: RATMAS_PAIRINGS_COMMAND,
      guildId: 'guild-123',
      reply,
    } as unknown as Parameters<typeof handlePairingsCommand>[0];

    await handlePairingsCommand(interaction, ratServiceMocks as unknown as RatService);

    expect(reply).toHaveBeenCalledWith({
      content: 'Database connection failed',
      ephemeral: true,
    });
  });
});
