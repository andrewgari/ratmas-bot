import type { Client } from 'discord.js';
import type {
  RatmasEvent,
  RatmasParticipant,
  RatmasPairing,
  CreateEventOptions,
  UpdateParticipantOptions,
  PairingResult,
  EventTiming,
} from '../types/ratmas.types.js';
import { RatmasEventStatus } from '../types/ratmas.types.js';
import { UserService } from './user.service.js';
import { MessageService } from './message.service.js';
import { validateStatusTransition, shuffleArray } from './rat.service.helpers.js';
import {
  calculateEventTiming,
  syncParticipantsFromRole as syncFromRole,
  notifyAllPairings,
  createPairings,
  validateUserHasRole,
} from './rat.service.operations.js';
import { RatmasRepository } from '../repositories/ratmas.repository.js';

/**
 * RatService - Manages Ratmas (Secret Santa) event state backed by persistent storage
 */
export class RatService {
  private readonly userService: UserService;
  private readonly messageService: MessageService;
  private readonly repository: RatmasRepository;

  constructor(
    _client: Client,
    userService: UserService,
    messageService: MessageService,
    repository: RatmasRepository = new RatmasRepository()
  ) {
    this.userService = userService;
    this.messageService = messageService;
    this.repository = repository;
  }

  // ==================== EVENT LIFECYCLE ====================

  async createEvent(options: CreateEventOptions): Promise<RatmasEvent> {
    const existingEvent = await this.repository.findActiveEventByGuild(options.guildId);
    if (existingEvent) {
      throw new Error(`Guild already has active event (status: ${existingEvent.status})`);
    }

    if (options.purchaseDeadline <= options.eventStartDate) {
      throw new Error('Purchase deadline must be after event start date');
    }
    if (options.revealDate <= options.purchaseDeadline) {
      throw new Error('Reveal date must be after purchase deadline');
    }
    if (options.eventEndDate <= options.revealDate) {
      throw new Error('Event end date must be after the opening/reveal date');
    }

    return this.repository.createEvent(options);
  }

  async getActiveEvent(guildId: string): Promise<RatmasEvent | null> {
    return this.repository.findActiveEventByGuild(guildId);
  }

  async getEvent(eventId: string): Promise<RatmasEvent | null> {
    return this.repository.findEventById(eventId);
  }

  async updateEventStatus(eventId: string, newStatus: RatmasEventStatus): Promise<RatmasEvent> {
    const event = await this.repository.findEventById(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    validateStatusTransition(event.status, newStatus);

    return this.repository.updateEventStatus(eventId, newStatus);
  }

  async cancelEvent(eventId: string): Promise<RatmasEvent> {
    return this.updateEventStatus(eventId, RatmasEventStatus.CANCELLED);
  }

  // ==================== PARTICIPANT MANAGEMENT ====================

  async addParticipant(
    eventId: string,
    userId: string,
    displayName: string,
    wishlistUrl?: string
  ): Promise<RatmasParticipant> {
    const event = await this.repository.findEventById(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.status !== RatmasEventStatus.OPEN) {
      throw new Error(`Cannot add participants to event with status: ${event.status}`);
    }

    const existingParticipant = await this.repository.findParticipantByEventAndUser(
      eventId,
      userId
    );
    if (existingParticipant) {
      throw new Error(`User ${userId} is already a participant`);
    }

    return this.repository.createParticipant({
      eventId,
      userId,
      guildId: event.guildId,
      displayName,
      wishlistUrl,
    });
  }

  async removeParticipant(eventId: string, userId: string): Promise<void> {
    const event = await this.repository.findEventById(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.status !== RatmasEventStatus.OPEN) {
      throw new Error(`Cannot remove participants from event with status: ${event.status}`);
    }

    const participant = await this.repository.findParticipantByEventAndUser(eventId, userId);
    if (!participant) {
      throw new Error(`User ${userId} is not a participant`);
    }

    await this.repository.deleteParticipant(participant.id);
  }

  async updateParticipant(
    participantId: string,
    updates: UpdateParticipantOptions
  ): Promise<RatmasParticipant> {
    const participant = await this.repository.findParticipantById(participantId);
    if (!participant) throw new Error(`Participant ${participantId} not found`);

    return this.repository.updateParticipant(participantId, updates);
  }

  async getParticipants(eventId: string): Promise<RatmasParticipant[]> {
    return this.repository.listParticipants(eventId);
  }

  async isParticipant(eventId: string, userId: string): Promise<boolean> {
    const participant = await this.repository.findParticipantByEventAndUser(eventId, userId);
    return participant !== null;
  }

  async getParticipantByUserId(eventId: string, userId: string): Promise<RatmasParticipant | null> {
    return this.repository.findParticipantByEventAndUser(eventId, userId);
  }

  // ==================== PAIRING/MATCHING ====================

  async generatePairings(eventId: string): Promise<PairingResult> {
    const event = await this.repository.findEventById(eventId);
    if (!event) {
      return { success: false, pairingsCreated: 0, error: 'Event not found' };
    }

    if (event.status !== RatmasEventStatus.LOCKED) {
      return {
        success: false,
        pairingsCreated: 0,
        error: `Cannot generate pairings for event with status: ${event.status}`,
      };
    }

    const participants = await this.repository.listParticipants(eventId);

    if (participants.length < 3) {
      return {
        success: false,
        pairingsCreated: 0,
        error: `Need at least 3 participants, found ${participants.length}`,
      };
    }

    const newPairings = createPairings(eventId, participants, shuffleArray);

    await this.repository.replacePairings(eventId, newPairings);
    await this.updateEventStatus(eventId, RatmasEventStatus.MATCHED);

    return {
      success: true,
      pairingsCreated: newPairings.length,
    };
  }

  async getPairingForSanta(eventId: string, userId: string): Promise<RatmasPairing | null> {
    const participant = await this.repository.findParticipantByEventAndUser(eventId, userId);
    if (!participant) return null;

    return this.repository.findPairingForSanta(eventId, participant.id);
  }

  async getRecipientForSanta(eventId: string, userId: string): Promise<RatmasParticipant | null> {
    const pairing = await this.getPairingForSanta(eventId, userId);
    if (!pairing) return null;

    return this.repository.findParticipantById(pairing.recipientId);
  }

  async notifyPairings(eventId: string): Promise<number> {
    const event = await this.repository.findEventById(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.status !== RatmasEventStatus.MATCHED) {
      throw new Error(`Cannot notify pairings for event with status: ${event.status}`);
    }

    const [pairings, participants] = await Promise.all([
      this.repository.listPairingsForEvent(eventId),
      this.repository.listParticipants(eventId),
    ]);

    const outstandingPairings = pairings.filter((pairing) => !pairing.notifiedAt);

    const { notifiedCount, notifiedPairings } = await notifyAllPairings(
      event,
      pairings,
      participants,
      this.messageService
    );

    if (notifiedPairings.length > 0) {
      await this.repository.markPairingsNotified(notifiedPairings);
    }

    const remainingOutstanding = Math.max(0, outstandingPairings.length - notifiedPairings.length);
    if (pairings.length > 0 && remainingOutstanding === 0) {
      await this.updateEventStatus(eventId, RatmasEventStatus.NOTIFIED);
    }

    return notifiedCount;
  }

  // ==================== TIME/DATE QUERIES ====================

  async getEventTiming(eventId: string): Promise<EventTiming | null> {
    const event = await this.repository.findEventById(eventId);
    if (!event) return null;

    return calculateEventTiming(event);
  }

  async isEventActive(eventId: string): Promise<boolean> {
    return (await this.getEventTiming(eventId))?.isActive ?? false;
  }

  async isPurchaseDeadlinePassed(eventId: string): Promise<boolean> {
    return (await this.getEventTiming(eventId))?.isPurchaseDeadlinePassed ?? false;
  }

  async getDaysUntilPurchaseDeadline(eventId: string): Promise<number> {
    return (await this.getEventTiming(eventId))?.daysUntilPurchaseDeadline ?? 0;
  }

  async getDaysUntilReveal(eventId: string): Promise<number> {
    return (await this.getEventTiming(eventId))?.daysUntilReveal ?? 0;
  }

  // ==================== ROLE INTEGRATION ====================

  async getRatmasRoleId(eventId: string): Promise<string | null> {
    const event = await this.repository.findEventById(eventId);
    return event?.config.ratmasRoleId ?? null;
  }

  async syncParticipantsFromRole(eventId: string): Promise<number> {
    const event = await this.repository.findEventById(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.status !== RatmasEventStatus.OPEN) {
      throw new Error(`Cannot sync participants for event with status: ${event.status}`);
    }

    const participants = await this.repository.listParticipants(eventId);
    const participantUserIds = new Set(participants.map((participant) => participant.userId));

    return syncFromRole(
      event,
      this.userService,
      participantUserIds,
      this.addParticipant.bind(this)
    );
  }

  async hasRatmasRole(eventId: string, userId: string): Promise<boolean> {
    const event = await this.repository.findEventById(eventId);
    if (!event) return false;

    return validateUserHasRole(this.userService, event.guildId, userId, event.config.ratmasRoleId);
  }
}
