import { Client } from 'discord.js';
import {
  RatmasEvent,
  RatmasParticipant,
  RatmasPairing,
  RatmasEventStatus,
  CreateEventOptions,
  UpdateParticipantOptions,
  PairingResult,
  EventTiming,
} from '../types/ratmas.types.js';
import { UserService } from './user.service.js';
import { MessageService } from './message.service.js';
import {
  validateStatusTransition,
  shuffleArray,
  generateId,
  findParticipantByUserId,
} from './rat.service.helpers.js';
import {
  calculateEventTiming,
  syncParticipantsFromRole as syncFromRole,
  notifyAllPairings,
  createPairings,
  validateUserHasRole,
} from './rat.service.operations.js';

/**
 * RatService - Manages Ratmas (Secret Santa) event state
 *
 * Core responsibilities:
 * - Event lifecycle management (create, update status, cancel)
 * - Participant enrollment and management
 * - Secret santa pairing generation and assignment
 * - Time-based queries and validations
 * - Integration with Discord roles and DMs
 *
 * Key Concept - Ratmas Role:
 * Each event is associated with a Discord role ID (ratmasRoleId) that links
 * all participants together. Users with this role are considered participants
 * in the event and can be auto-enrolled via syncParticipantsFromRole().
 */
export class RatService {
  private userService: UserService;
  private messageService: MessageService;

  // In-memory storage (will be replaced with SQLite repository)
  private events: Map<string, RatmasEvent> = new Map();
  private participants: Map<string, RatmasParticipant> = new Map();
  private pairings: Map<string, RatmasPairing> = new Map();

  constructor(
    _client: Client,
    userService: UserService,
    messageService: MessageService
  ) {
    this.userService = userService;
    this.messageService = messageService;
  }

  // ==================== EVENT LIFECYCLE ====================

  async createEvent(options: CreateEventOptions): Promise<RatmasEvent> {
    const existingEvent = this.getActiveEvent(options.guildId);
    if (existingEvent) {
      throw new Error(
        `Guild already has active event (status: ${existingEvent.status})`
      );
    }

    if (options.purchaseDeadline <= options.eventStartDate) {
      throw new Error('Purchase deadline must be after event start date');
    }
    if (options.revealDate <= options.purchaseDeadline) {
      throw new Error('Reveal date must be after purchase deadline');
    }

    const event: RatmasEvent = {
      id: generateId(),
      guildId: options.guildId,
      status: RatmasEventStatus.OPEN,
      config: {
        ratmasRoleId: options.ratmasRoleId,
        eventStartDate: options.eventStartDate,
        purchaseDeadline: options.purchaseDeadline,
        revealDate: options.revealDate,
        timezone: options.timezone,
        announcementChannelId: options.announcementChannelId,
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.events.set(event.id, event);
    return event;
  }

  getActiveEvent(guildId: string): RatmasEvent | null {
    for (const event of this.events.values()) {
      if (
        event.guildId === guildId &&
        event.status !== RatmasEventStatus.COMPLETED &&
        event.status !== RatmasEventStatus.CANCELLED
      ) {
        return event;
      }
    }
    return null;
  }

  getEvent(eventId: string): RatmasEvent | null {
    return this.events.get(eventId) || null;
  }

  async updateEventStatus(
    eventId: string,
    newStatus: RatmasEventStatus
  ): Promise<RatmasEvent> {
    const event = this.events.get(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    validateStatusTransition(event.status, newStatus);

    event.status = newStatus;
    event.updatedAt = new Date();
    this.events.set(eventId, event);

    return event;
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
    const event = this.events.get(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.status !== RatmasEventStatus.OPEN) {
      throw new Error(
        `Cannot add participants to event with status: ${event.status}`
      );
    }

    if (this.isParticipant(eventId, userId)) {
      throw new Error(`User ${userId} is already a participant`);
    }

    const participant: RatmasParticipant = {
      id: generateId(),
      eventId,
      userId,
      guildId: event.guildId,
      displayName,
      wishlistUrl,
      joinedAt: new Date(),
      updatedAt: new Date(),
    };

    this.participants.set(participant.id, participant);
    return participant;
  }

  async removeParticipant(eventId: string, userId: string): Promise<void> {
    const event = this.events.get(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.status !== RatmasEventStatus.OPEN) {
      throw new Error(
        `Cannot remove participants from event with status: ${event.status}`
      );
    }

    const participant = findParticipantByUserId(
      this.participants,
      eventId,
      userId
    );
    if (!participant) {
      throw new Error(`User ${userId} is not a participant`);
    }

    this.participants.delete(participant.id);
  }

  async updateParticipant(
    participantId: string,
    updates: UpdateParticipantOptions
  ): Promise<RatmasParticipant> {
    const participant = this.participants.get(participantId);
    if (!participant) throw new Error(`Participant ${participantId} not found`);

    if (updates.displayName !== undefined) {
      participant.displayName = updates.displayName;
    }
    if (updates.wishlistUrl !== undefined) {
      participant.wishlistUrl = updates.wishlistUrl;
    }

    participant.updatedAt = new Date();
    this.participants.set(participantId, participant);

    return participant;
  }

  getParticipants(eventId: string): RatmasParticipant[] {
    return Array.from(this.participants.values()).filter(
      (p) => p.eventId === eventId
    );
  }

  isParticipant(eventId: string, userId: string): boolean {
    return (
      findParticipantByUserId(this.participants, eventId, userId) !== null
    );
  }

  getParticipantByUserId(
    eventId: string,
    userId: string
  ): RatmasParticipant | null {
    return findParticipantByUserId(this.participants, eventId, userId);
  }

  // ==================== PAIRING/MATCHING ====================

  async generatePairings(eventId: string): Promise<PairingResult> {
    const event = this.events.get(eventId);
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

    const participants = this.getParticipants(eventId);

    if (participants.length < 3) {
      return {
        success: false,
        pairingsCreated: 0,
        error: `Need at least 3 participants, found ${participants.length}`,
      };
    }

    const newPairings = createPairings(eventId, participants, shuffleArray);

    for (const pairing of newPairings) {
      this.pairings.set(pairing.id, pairing);
    }

    await this.updateEventStatus(eventId, RatmasEventStatus.MATCHED);

    return {
      success: true,
      pairingsCreated: newPairings.length,
    };
  }

  getPairingForSanta(eventId: string, userId: string): RatmasPairing | null {
    const participant = findParticipantByUserId(
      this.participants,
      eventId,
      userId
    );
    if (!participant) return null;

    for (const pairing of this.pairings.values()) {
      if (pairing.eventId === eventId && pairing.santaId === participant.id) {
        return pairing;
      }
    }

    return null;
  }

  getRecipientForSanta(
    eventId: string,
    userId: string
  ): RatmasParticipant | null {
    const pairing = this.getPairingForSanta(eventId, userId);
    if (!pairing) return null;

    return this.participants.get(pairing.recipientId) || null;
  }

  async notifyPairings(eventId: string): Promise<number> {
    const event = this.events.get(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.status !== RatmasEventStatus.MATCHED) {
      throw new Error(
        `Cannot notify pairings for event with status: ${event.status}`
      );
    }

    const notifiedCount = await notifyAllPairings(
      event,
      this.pairings,
      this.participants,
      this.messageService
    );

    await this.updateEventStatus(eventId, RatmasEventStatus.NOTIFIED);

    return notifiedCount;
  }

  // ==================== TIME/DATE QUERIES ====================

  getEventTiming(eventId: string): EventTiming | null {
    const event = this.events.get(eventId);
    if (!event) return null;

    return calculateEventTiming(event);
  }

  isEventActive(eventId: string): boolean {
    return this.getEventTiming(eventId)?.isActive || false;
  }

  isPurchaseDeadlinePassed(eventId: string): boolean {
    return this.getEventTiming(eventId)?.isPurchaseDeadlinePassed || false;
  }

  getDaysUntilPurchaseDeadline(eventId: string): number {
    return this.getEventTiming(eventId)?.daysUntilPurchaseDeadline || 0;
  }

  getDaysUntilReveal(eventId: string): number {
    return this.getEventTiming(eventId)?.daysUntilReveal || 0;
  }

  // ==================== ROLE INTEGRATION ====================

  /**
   * Get the Ratmas role ID for an event
   */
  getRatmasRoleId(eventId: string): string | null {
    const event = this.events.get(eventId);
    return event?.config.ratmasRoleId || null;
  }

  async syncParticipantsFromRole(eventId: string): Promise<number> {
    const event = this.events.get(eventId);
    if (!event) throw new Error(`Event ${eventId} not found`);

    if (event.status !== RatmasEventStatus.OPEN) {
      throw new Error(
        `Cannot sync participants for event with status: ${event.status}`
      );
    }

    return syncFromRole(
      event,
      this.userService,
      this.participants,
      this.addParticipant.bind(this)
    );
  }

  async hasRatmasRole(eventId: string, userId: string): Promise<boolean> {
    const event = this.events.get(eventId);
    if (!event) return false;
    return validateUserHasRole(
      this.userService,
      event.guildId,
      userId,
      event.config.ratmasRoleId
    );
  }
}
