// @ts-nocheck
import { jest } from '@jest/globals';
import { ChannelService } from '../src/services/channel.service.js';
import type { Client } from 'discord.js';

describe('ChannelService - moveChannelToCategory', () => {
  let channelService: ChannelService;
  let mockClient: Client;
  let mockChannel: any;

  beforeEach(() => {
    mockChannel = {
      setParent: jest.fn().mockResolvedValue(undefined),
    };

    mockClient = {
      channels: {
        fetch: jest.fn().mockResolvedValue(mockChannel),
      },
    } as unknown as Client;

    channelService = new ChannelService(mockClient);
  });

  describe('successful operations', () => {
    it('should move channel to a category', async () => {
      const result = await channelService.moveChannelToCategory('channel-123', 'category-456');

      expect(result.success).toBe(true);
      expect(mockClient.channels.fetch).toHaveBeenCalledWith('channel-123');
      expect(mockChannel.setParent).toHaveBeenCalledWith('category-456');
    });

    it('should remove channel from category when categoryId is null', async () => {
      const result = await channelService.moveChannelToCategory('channel-123', null);

      expect(result.success).toBe(true);
      expect(mockChannel.setParent).toHaveBeenCalledWith(null);
    });
  });

  describe('error handling', () => {
    it('should return error when channel not found', async () => {
      (mockClient.channels.fetch as jest.Mock).mockResolvedValueOnce(null);

      const result = await channelService.moveChannelToCategory('nonexistent', 'category-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel with ID nonexistent not found');
    });

    it('should return error when channel does not support parent', async () => {
      const channelWithoutSetParent = {};
      (mockClient.channels.fetch as jest.Mock).mockResolvedValueOnce(channelWithoutSetParent);

      const result = await channelService.moveChannelToCategory('channel-123', 'category-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Channel does not support parent category');
    });

    it('should return error when setParent throws', async () => {
      mockChannel.setParent = jest.fn().mockRejectedValue(new Error('Discord API error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await channelService.moveChannelToCategory('channel-123', 'category-456');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Discord API error');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
