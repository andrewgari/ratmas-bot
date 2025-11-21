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
    getActiveEvent: jest.fn<() => Promise<any>>(),
    getOrCreateParticipant: jest.fn<() => Promise<any>>(),
    updateParticipant: jest.fn<() => Promise<any>>(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('handleWishlistCommand', () => {
    it('ignores interactions that are not for the wishlist command', async () => {
      const showModal = jest.fn();
      const interaction = {
        commandName: 'some-other-command',
        showModal,
      } as unknown as Parameters<typeof handleWishlistCommand>[0];

      await handleWishlistCommand(interaction);

      expect(showModal).not.toHaveBeenCalled();
    });

    it('shows the wishlist modal when invoked', async () => {
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
  });

  describe('handleWishlistModal', () => {
    it('ignores modals that are not the wishlist modal', async () => {
      const reply = jest.fn();
      const interaction = {
        customId: 'some-other-modal',
        guildId: 'guild-123',
        reply,
      } as unknown as Parameters<typeof handleWishlistModal>[0];

      await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

      expect(reply).not.toHaveBeenCalled();
      expect(ratServiceMocks.getActiveEvent).not.toHaveBeenCalled();
    });

    it('replies with error when not in a guild', async () => {
      const reply = jest.fn();
      const interaction = {
        customId: RATMAS_WISHLIST_MODAL_ID,
        guildId: null,
        reply,
      } as unknown as Parameters<typeof handleWishlistModal>[0];

      await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

      expect(reply).toHaveBeenCalledWith({
        content: 'This command can only be used in a server.',
        ephemeral: true,
      });
    });

    it('replies with error when URL is invalid', async () => {
      const reply = jest.fn();
      const interaction = {
        customId: RATMAS_WISHLIST_MODAL_ID,
        guildId: 'guild-123',
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('not-a-url'),
        },
        reply,
      } as unknown as Parameters<typeof handleWishlistModal>[0];

      await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

      expect(reply).toHaveBeenCalledWith({
        content: 'Please provide a valid URL.',
        ephemeral: true,
      });
    });

    it('replies with error when no active event exists', async () => {
      ratServiceMocks.getActiveEvent.mockResolvedValue(null);

      const reply = jest.fn();
      const interaction = {
        customId: RATMAS_WISHLIST_MODAL_ID,
        guildId: 'guild-123',
        user: { id: 'user-123', username: 'testuser' },
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('https://www.amazon.com/wishlist/123'),
        },
        reply,
      } as unknown as Parameters<typeof handleWishlistModal>[0];

      await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

      expect(ratServiceMocks.getActiveEvent).toHaveBeenCalledWith('guild-123');
      expect(reply).toHaveBeenCalledWith({
        content: 'No active Ratmas event.',
        ephemeral: true,
      });
    });

    it('saves wishlist and replies with success when valid', async () => {
      const mockEvent = {
        id: 'event-123',
        guildId: 'guild-123',
        status: RatmasEventStatus.WISHLIST,
        config: {
          ratmasRoleId: 'role-123',
          eventStartDate: new Date(),
          purchaseDeadline: new Date(),
          revealDate: new Date(),
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockParticipant = {
        id: 'participant-123',
        eventId: 'event-123',
        userId: 'user-123',
        guildId: 'guild-123',
        displayName: 'testuser',
        joinedAt: new Date(),
        updatedAt: new Date(),
      };
      ratServiceMocks.getActiveEvent.mockResolvedValue(mockEvent);
      ratServiceMocks.getOrCreateParticipant.mockResolvedValue(mockParticipant);
      ratServiceMocks.updateParticipant.mockResolvedValue({
        ...mockParticipant,
        wishlistUrl: 'https://www.amazon.com/wishlist/123',
      });

      const reply = jest.fn();
      const interaction = {
        customId: RATMAS_WISHLIST_MODAL_ID,
        guildId: 'guild-123',
        user: { id: 'user-123', username: 'testuser' },
        member: { user: { username: 'testuser' } },
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('https://www.amazon.com/wishlist/123'),
        },
        reply,
      } as unknown as Parameters<typeof handleWishlistModal>[0];

      await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

      expect(ratServiceMocks.getActiveEvent).toHaveBeenCalledWith('guild-123');
      expect(ratServiceMocks.getOrCreateParticipant).toHaveBeenCalledWith(
        'event-123',
        'user-123',
        'testuser'
      );
      expect(ratServiceMocks.updateParticipant).toHaveBeenCalledWith('participant-123', {
        wishlistUrl: 'https://www.amazon.com/wishlist/123',
      });
      expect(reply).toHaveBeenCalledWith({
        content: 'Your wishlist has been saved!',
        ephemeral: true,
      });
    });

    it('handles unexpected errors gracefully', async () => {
      ratServiceMocks.getActiveEvent.mockRejectedValue(new Error('Database connection failed'));

      const reply = jest.fn();
      const interaction = {
        customId: RATMAS_WISHLIST_MODAL_ID,
        guildId: 'guild-123',
        user: { id: 'user-123', username: 'testuser' },
        fields: {
          getTextInputValue: jest.fn().mockReturnValue('https://www.amazon.com/wishlist/123'),
        },
        reply,
      } as unknown as Parameters<typeof handleWishlistModal>[0];

      await handleWishlistModal(interaction, ratServiceMocks as unknown as RatService);

      expect(reply).toHaveBeenCalledWith({
        content: 'Database connection failed',
        ephemeral: true,
      });
    });
  });
});
