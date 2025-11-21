/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - Jest mock types are incompatible with service/repository signatures
import { jest } from '@jest/globals';
import type { Client } from 'discord.js';
import { RatService } from '../src/services/rat.service.js';
import { UserService } from '../src/services/user.service.js';
import { MessageService } from '../src/services/message.service.js';
import { ChannelService } from '../src/services/channel.service.js';
import { RatmasRepository } from '../src/repositories/ratmas.repository.js';
import { RatmasEventStatus } from '../src/types/ratmas.types.js';
import type { RatmasEvent, RatmasParticipant } from '../src/types/ratmas.types.js';

describe('RatService - completeEvent', () => {
  let ratService: RatService;
  let mockClient: Client;
  let mockUserService: UserService;
  let mockMessageService: MessageService;
  let mockChannelService: ChannelService;
  let mockRepository: RatmasRepository;

  const mockEvent: RatmasEvent = {
    id: 'event-123',
    guildId: 'guild-123',
    status: RatmasEventStatus.NOTIFIED,
    config: {
      ratmasRoleId: 'role-123',
      eventStartDate: new Date('2025-12-01'),
      purchaseDeadline: new Date('2025-12-20'),
      revealDate: new Date('2025-12-25'),
      timezone: 'America/New_York',
      announcementChannelId: 'channel-123',
      archivedCategoryId: 'category-archived',
    },
    createdAt: new Date('2025-11-01'),
    updatedAt: new Date('2025-11-20'),
  };

  const mockParticipants: RatmasParticipant[] = [
    {
      id: 'participant-1',
      eventId: 'event-123',
      userId: 'user-1',
      guildId: 'guild-123',
      displayName: 'Alice',
      wishlistUrl: 'https://amazon.com/wishlist/alice',
      joinedAt: new Date('2025-11-10'),
      updatedAt: new Date('2025-11-10'),
    },
    {
      id: 'participant-2',
      eventId: 'event-123',
      userId: 'user-2',
      guildId: 'guild-123',
      displayName: 'Bob',
      wishlistUrl: 'https://amazon.com/wishlist/bob',
      joinedAt: new Date('2025-11-11'),
      updatedAt: new Date('2025-11-11'),
    },
    {
      id: 'participant-3',
      eventId: 'event-123',
      userId: 'user-3',
      guildId: 'guild-123',
      displayName: 'Charlie',
      joinedAt: new Date('2025-11-12'),
      updatedAt: new Date('2025-11-12'),
    },
  ];

  beforeEach(() => {
    mockClient = {} as Client;
    mockUserService = {} as UserService;

    mockMessageService = {
      sendEmbed: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as MessageService;

    mockChannelService = {
      moveChannelToCategory: jest.fn().mockResolvedValue({ success: true }),
    } as unknown as ChannelService;

    mockRepository = {
      findEventById: jest.fn().mockResolvedValue(mockEvent),
      listParticipants: jest.fn().mockResolvedValue(mockParticipants),
      updateEventStatus: jest.fn().mockResolvedValue({
        ...mockEvent,
        status: RatmasEventStatus.COMPLETED,
      }),
    } as unknown as RatmasRepository;

    ratService = new RatService(
      mockClient,
      mockUserService,
      mockMessageService,
      mockChannelService,
      mockRepository
    );
  });

  describe('successful completion', () => {
    it('should complete event with announcement and archiving', async () => {
      const result = await ratService.completeEvent('event-123');

      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
      expect(mockRepository.findEventById).toHaveBeenCalledWith('event-123');
      expect(mockRepository.listParticipants).toHaveBeenCalledWith('event-123');
      expect(mockMessageService.sendEmbed).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          title: '🎄 Ratmas Has Ended! 🎄',
          description: expect.stringContaining('3 participants'),
          color: 0x00ff00,
        })
      );
      expect(mockChannelService.moveChannelToCategory).toHaveBeenCalledWith(
        'channel-123',
        'category-archived'
      );
      expect(mockRepository.updateEventStatus).toHaveBeenCalledWith(
        'event-123',
        RatmasEventStatus.COMPLETED
      );
    });

    it('should complete event without announcement when sendAnnouncement is false', async () => {
      const result = await ratService.completeEvent('event-123', { sendAnnouncement: false });

      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
      expect(mockMessageService.sendEmbed).not.toHaveBeenCalled();
      expect(mockChannelService.moveChannelToCategory).toHaveBeenCalled();
    });

    it('should complete event without archiving when archiveChannels is false', async () => {
      const result = await ratService.completeEvent('event-123', { archiveChannels: false });

      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
      expect(mockMessageService.sendEmbed).toHaveBeenCalled();
      expect(mockChannelService.moveChannelToCategory).not.toHaveBeenCalled();
    });

    it('should skip announcement when no announcement channel configured', async () => {
      const eventWithoutChannel = { ...mockEvent, config: { ...mockEvent.config } };
      eventWithoutChannel.config.announcementChannelId = undefined;

      (mockRepository.findEventById as jest.Mock).mockResolvedValueOnce(eventWithoutChannel);

      const result = await ratService.completeEvent('event-123');

      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
      expect(mockMessageService.sendEmbed).not.toHaveBeenCalled();
    });

    it('should skip archiving when no archived category configured', async () => {
      const eventWithoutArchive = { ...mockEvent, config: { ...mockEvent.config } };
      eventWithoutArchive.config.archivedCategoryId = undefined;

      (mockRepository.findEventById as jest.Mock).mockResolvedValueOnce(eventWithoutArchive);

      const result = await ratService.completeEvent('event-123');

      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
      expect(mockChannelService.moveChannelToCategory).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error when event not found', async () => {
      (mockRepository.findEventById as jest.Mock).mockResolvedValueOnce(null);

      await expect(ratService.completeEvent('nonexistent')).rejects.toThrow(
        'Event nonexistent not found'
      );
    });

    it('should throw error when invalid status transition', async () => {
      const openEvent = { ...mockEvent, status: RatmasEventStatus.OPEN };
      (mockRepository.findEventById as jest.Mock).mockResolvedValueOnce(openEvent);

      await expect(ratService.completeEvent('event-123')).rejects.toThrow(
        'Invalid status transition'
      );
    });

    it('should complete event even if announcement fails', async () => {
      (mockMessageService.sendEmbed as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ratService.completeEvent('event-123');

      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to send completion announcement:',
        expect.any(Error)
      );
      expect(mockRepository.updateEventStatus).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should complete event even if archiving fails', async () => {
      (mockChannelService.moveChannelToCategory as jest.Mock).mockResolvedValueOnce({
        success: false,
        error: 'Channel not found',
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ratService.completeEvent('event-123');

      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to archive announcement channel:',
        'Channel not found'
      );
      expect(mockRepository.updateEventStatus).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should complete event even if archiving throws exception', async () => {
      (mockChannelService.moveChannelToCategory as jest.Mock).mockRejectedValueOnce(
        new Error('Discord API error')
      );

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await ratService.completeEvent('event-123');

      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to archive announcement channel:',
        expect.any(Error)
      );
      expect(mockRepository.updateEventStatus).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('status transitions', () => {
    it('should allow transition from NOTIFIED to COMPLETED', async () => {
      const notifiedEvent = { ...mockEvent, status: RatmasEventStatus.NOTIFIED };
      (mockRepository.findEventById as jest.Mock).mockResolvedValueOnce(notifiedEvent);

      const result = await ratService.completeEvent('event-123');
      expect(result.status).toBe(RatmasEventStatus.COMPLETED);
    });

    it('should reject transition from OPEN to COMPLETED', async () => {
      const openEvent = { ...mockEvent, status: RatmasEventStatus.OPEN };
      (mockRepository.findEventById as jest.Mock).mockResolvedValueOnce(openEvent);

      await expect(ratService.completeEvent('event-123')).rejects.toThrow();
    });

    it('should reject transition from LOCKED to COMPLETED', async () => {
      const lockedEvent = { ...mockEvent, status: RatmasEventStatus.LOCKED };
      (mockRepository.findEventById as jest.Mock).mockResolvedValueOnce(lockedEvent);

      await expect(ratService.completeEvent('event-123')).rejects.toThrow();
    });

    it('should reject transition from MATCHED to COMPLETED', async () => {
      const matchedEvent = { ...mockEvent, status: RatmasEventStatus.MATCHED };
      (mockRepository.findEventById as jest.Mock).mockResolvedValueOnce(matchedEvent);

      await expect(ratService.completeEvent('event-123')).rejects.toThrow();
    });
  });

  describe('participant count in announcement', () => {
    it('should show correct count with 1 participant', async () => {
      const singleParticipant = [mockParticipants[0]];
      (mockRepository.listParticipants as jest.Mock).mockResolvedValueOnce(singleParticipant);

      await ratService.completeEvent('event-123');

      expect(mockMessageService.sendEmbed).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          description: expect.stringContaining('1 participant'),
        })
      );
    });

    it('should show correct count with multiple participants', async () => {
      await ratService.completeEvent('event-123');

      expect(mockMessageService.sendEmbed).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          description: expect.stringContaining('3 participants'),
        })
      );
    });

    it('should show 0 participants when none exist', async () => {
      (mockRepository.listParticipants as jest.Mock).mockResolvedValueOnce([]);

      await ratService.completeEvent('event-123');

      expect(mockMessageService.sendEmbed).toHaveBeenCalledWith(
        'channel-123',
        expect.objectContaining({
          description: expect.stringContaining('0 participants'),
        })
      );
    });
  });
});
