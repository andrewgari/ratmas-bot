import type {
  RatmasEvent,
  RatmasParticipant,
  RatmasPairing,
  EventTiming,
} from '../types/ratmas.types.js';
import { UserService } from './user.service.js';
import { MessageService } from './message.service.js';
import { generateId, buildPairingNotificationMessage } from './rat.service.helpers.js';

/**
 * Extended operations for RatService
 */

/**
 * Get timing information for an event
 */
export function calculateEventTiming(event: RatmasEvent): EventTiming {
  const now = new Date();
  const { eventStartDate, purchaseDeadline, revealDate } = event.config;

  return {
    isActive: now >= eventStartDate && now <= revealDate,
    isPurchaseDeadlinePassed: now > purchaseDeadline,
    daysUntilPurchaseDeadline: Math.ceil(
      (purchaseDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
    daysUntilReveal: Math.ceil((revealDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    currentDateInTimezone: now,
  };
}

/**
 * Sync participants from Discord role
 */
export async function syncParticipantsFromRole(
  event: RatmasEvent,
  userService: UserService,
  participantUserIds: Set<string>,
  addParticipantFn: (
    eventId: string,
    userId: string,
    displayName: string
  ) => Promise<RatmasParticipant>
): Promise<number> {
  const members = await userService.getGuildMembers(event.guildId, {
    roleIds: [event.config.ratmasRoleId],
    excludeBots: true,
  });

  let addedCount = 0;

  for (const member of members) {
    if (participantUserIds.has(member.profile.id)) continue;

    try {
      await addParticipantFn(
        event.id,
        member.profile.id,
        member.nickname || member.profile.username
      );
      addedCount++;
      participantUserIds.add(member.profile.id);
    } catch (error) {
      console.error(`Failed to add participant ${member.profile.id}:`, error);
    }
  }

  return addedCount;
}

/**
 * Notify all santas via DM
 */
export async function notifyAllPairings(
  event: RatmasEvent,
  pairings: RatmasPairing[],
  participants: RatmasParticipant[],
  messageService: MessageService
): Promise<{
  notifiedCount: number;
  notifiedPairings: { pairingId: string; notifiedAt: Date }[];
}> {
  let notifiedCount = 0;
  const notifiedPairings: { pairingId: string; notifiedAt: Date }[] = [];
  const participantMap = new Map(participants.map((participant) => [participant.id, participant]));

  for (const pairing of pairings) {
    if (pairing.eventId !== event.id) continue;
    if (pairing.notifiedAt) continue;

    const santa = participantMap.get(pairing.santaId);
    const recipient = participantMap.get(pairing.recipientId);

    if (!santa || !recipient) continue;

    const message = buildPairingNotificationMessage(event, santa, recipient);
    const result = await messageService.sendDirectMessage(santa.userId, message);

    if (result.success) {
      const notifiedAt = new Date();
      notifiedPairings.push({ pairingId: pairing.id, notifiedAt });
      notifiedCount++;
    }
  }

  return { notifiedCount, notifiedPairings };
}

/**
 * Generate pairings for participants
 */
export function createPairings(
  eventId: string,
  participants: RatmasParticipant[],
  shuffleFn: <T>(array: T[]) => T[]
): RatmasPairing[] {
  if (participants.length < 3) {
    throw new Error(`Need at least 3 participants, found ${participants.length}`);
  }

  const shuffled = shuffleFn([...participants]);
  const now = new Date();
  const newPairings: RatmasPairing[] = [];

  for (let i = 0; i < shuffled.length; i++) {
    const santa = shuffled[i]!;
    const recipient = shuffled[(i + 1) % shuffled.length]!;

    newPairings.push({
      id: generateId(),
      eventId,
      santaId: santa.id,
      recipientId: recipient.id,
      createdAt: now,
    });
  }

  return newPairings;
}

/**
 * Validate if user has a specific role
 */
export async function validateUserHasRole(
  userService: UserService,
  guildId: string,
  userId: string,
  roleId: string
): Promise<boolean> {
  try {
    const members = await userService.getGuildMembers(guildId, {
      roleIds: [roleId],
    });

    return members.some((m) => m.profile.id === userId);
  } catch (error) {
    console.error('Error validating user role:', error);
    return false;
  }
}
