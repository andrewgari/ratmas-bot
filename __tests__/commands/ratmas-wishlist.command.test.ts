import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  handleWishlistCommand,
  handleWishlistModal,
  RATMAS_WISHLIST_COMMAND,
  RATMAS_WISHLIST_MODAL_ID,
} from '../../src/commands/ratmas-wishlist.command.js';
import { RatService } from '../../src/services/rat.service.js';
import { RatmasEventStatus } from '../../src/types/ratmas.types.js';

describe('ratmas-wishlist command', () => {
  const ratServiceMocks = {
    getActiveEvent: jest.fn(),
    getOrCreateParticipant: jest.fn(),
    updateParticipant: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('shows the wishlist modal when user invokes /wishlist', async () => {
    const showModal = jest.fn();
    const interaction = {
      commandName: RATMAS_WISHLIST_COMMAND,
      showModal,
    } as unknown as Parameters<typeof handleWishlistCommand>[0];

    await handleWishlistCommand(interaction);

    expect(showModal).toHaveBeenCalledTimes(1);
    const modal = showModal.mock.calls[0]?.[0] as { data?: { custom_id?: string } } | undefined;
    expect(modal?.data?.custom_id).toBe(RATMAS_WISHLIST_MODAL_ID);
  });

  it('ignores non-wishlist commands', async () => {
    const showModal = jest.fn();
    const interaction = {
      commandName: 'some-other-command',
      showModal,
    } as unknown as Parameters<typeof handleWishlistCommand>[0];

    await handleWishlistCommand(interaction);

    expect(showModal).not.toHaveBeenCalled();
  });

  it('rejects if command is used outside a server', async () => {
    const reply = jest.fn();
    const interaction = {
      customId: RATMAS_WISHLIST_MODAL_ID,
      guildId: null,
      reply,
      fields: {
        getTextInputValue: jest.fn(() => 'https://amazon.com/wishlist'),
      },
    } as unknown as Parameters<typeof handleWishlistModal>[0];

    await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

    expect(reply).toHaveBeenCalledWith({
      content: 'This command can only be used in a server.',
      ephemeral: true,
    });
  });

  it('rejects invalid URLs', async () => {
    const reply = jest.fn();
    const interaction = {
      customId: RATMAS_WISHLIST_MODAL_ID,
      guildId: 'guild-123',
      user: { id: 'user-123', username: 'testuser' },
      member: { user: { username: 'testuser' } },
      reply,
      fields: {
        getTextInputValue: jest.fn(() => 'not-a-url'),
      },
    } as unknown as Parameters<typeof handleWishlistModal>[0];

    await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

    expect(reply).toHaveBeenCalledWith({
      content: 'Please provide a valid URL.',
      ephemeral: true,
    });
  });

  it('saves valid wishlist URL', async () => {
    const reply = jest.fn();
    const mockEvent = {
      id: 'event-123',
      guildId: 'guild-123',
      status: RatmasEventStatus.WISHLIST,
    };
    const mockParticipant = {
      id: 'participant-123',
      userId: 'user-123',
      eventId: 'event-123',
    };

    ratServiceMocks.getActiveEvent.mockResolvedValue(mockEvent as never);
    ratServiceMocks.getOrCreateParticipant.mockResolvedValue(mockParticipant as never);
    ratServiceMocks.updateParticipant.mockResolvedValue({
      ...mockParticipant,
      wishlistUrl: 'https://amazon.com/wishlist',
    } as never);

    const interaction = {
      customId: RATMAS_WISHLIST_MODAL_ID,
      guildId: 'guild-123',
      user: { id: 'user-123', username: 'testuser' },
      member: { user: { username: 'testuser' } },
      reply,
      fields: {
        getTextInputValue: jest.fn(() => 'https://amazon.com/wishlist'),
      },
    } as unknown as Parameters<typeof handleWishlistModal>[0];

    await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

    expect(ratServiceMocks.getActiveEvent).toHaveBeenCalledWith('guild-123');
    expect(ratServiceMocks.getOrCreateParticipant).toHaveBeenCalledWith(
      'event-123',
      'user-123',
      'testuser'
    );
    expect(ratServiceMocks.updateParticipant).toHaveBeenCalledWith('participant-123', {
      wishlistUrl: 'https://amazon.com/wishlist',
    });
    expect(reply).toHaveBeenCalledWith({
      content: 'Your wishlist has been saved!',
      ephemeral: true,
    });
  });

  it('handles error when no active event exists', async () => {
    const reply = jest.fn();
    ratServiceMocks.getActiveEvent.mockResolvedValue(null as never);

    const interaction = {
      customId: RATMAS_WISHLIST_MODAL_ID,
      guildId: 'guild-123',
      user: { id: 'user-123', username: 'testuser' },
      member: { user: { username: 'testuser' } },
      reply,
      fields: {
        getTextInputValue: jest.fn(() => 'https://amazon.com/wishlist'),
      },
    } as unknown as Parameters<typeof handleWishlistModal>[0];

    await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

    expect(reply).toHaveBeenCalledWith({
      content: 'No active Ratmas event.',
      ephemeral: true,
    });
  });
});
