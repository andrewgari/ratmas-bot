import {
  RatmasEvent,
  RatmasParticipant,
  RatmasEventStatus,
} from '../types/ratmas.types.js';

/**
 * Helper utilities for RatService
 */

/**
 * Validate event status transition
 */
export function validateStatusTransition(
  currentStatus: RatmasEventStatus,
  newStatus: RatmasEventStatus
): void {
  const validTransitions: Record<RatmasEventStatus, RatmasEventStatus[]> = {
    [RatmasEventStatus.OPEN]: [
      RatmasEventStatus.LOCKED,
      RatmasEventStatus.CANCELLED,
    ],
    [RatmasEventStatus.LOCKED]: [
      RatmasEventStatus.MATCHED,
      RatmasEventStatus.OPEN,
      RatmasEventStatus.CANCELLED,
    ],
    [RatmasEventStatus.MATCHED]: [
      RatmasEventStatus.NOTIFIED,
      RatmasEventStatus.CANCELLED,
    ],
    [RatmasEventStatus.NOTIFIED]: [
      RatmasEventStatus.COMPLETED,
      RatmasEventStatus.CANCELLED,
    ],
    [RatmasEventStatus.COMPLETED]: [],
    [RatmasEventStatus.CANCELLED]: [],
  };

  const allowed = validTransitions[currentStatus];
  if (!allowed.includes(newStatus)) {
    throw new Error(
      `Invalid status transition from ${currentStatus} to ${newStatus}`
    );
  }
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j]!;
    shuffled[j] = temp!;
  }
  return shuffled;
}

/**
 * Generate unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Build pairing notification DM message
 */
export function buildPairingNotificationMessage(
  event: RatmasEvent,
  santa: RatmasParticipant,
  recipient: RatmasParticipant
): string {
  const { purchaseDeadline, revealDate, timezone } = event.config;

  let message = `🎄 **Ratmas Secret Santa Assignment** 🎁\n\n`;
  message += `Hello ${santa.displayName}!\n\n`;
  message += `You are the Secret Santa for: **${recipient.displayName}**\n\n`;

  if (recipient.wishlistUrl) {
    message += `Their wishlist: ${recipient.wishlistUrl}\n\n`;
  } else {
    message += `They haven't provided a wishlist yet. Stay tuned!\n\n`;
  }

  message += `**Important Dates** (${timezone}):\n`;
  message += `• Purchase by: ${purchaseDeadline.toLocaleDateString()}\n`;
  message += `• Reveal date: ${revealDate.toLocaleDateString()}\n\n`;
  message += `Keep this assignment secret! 🤫\n`;
  message += `Happy gifting! 🎅`;

  return message;
}

/**
 * Find participant by user ID in a collection
 */
export function findParticipantByUserId(
  participants: Map<string, RatmasParticipant>,
  eventId: string,
  userId: string
): RatmasParticipant | null {
  for (const participant of participants.values()) {
    if (participant.eventId === eventId && participant.userId === userId) {
      return participant;
    }
  }
  return null;
}
