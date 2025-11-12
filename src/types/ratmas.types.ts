/**
 * Lifecycle status of a Ratmas event
 */
export enum RatmasEventStatus {
  OPEN = 'open', // Accepting participants
  LOCKED = 'locked', // No new participants, not yet matched
  MATCHED = 'matched', // Pairings generated
  NOTIFIED = 'notified', // Participants notified of matches
  COMPLETED = 'completed', // Event finished
  CANCELLED = 'cancelled', // Event cancelled
}

/**
 * Configuration for a Ratmas event including timing and rules
 */
export interface RatmasEventConfig {
  ratmasRoleId: string; // Discord role ID for Ratmas participants (links everyone together)
  eventStartDate: Date; // When the event begins
  purchaseDeadline: Date; // Last day to purchase gifts
  revealDate: Date; // When secret santas are revealed
  eventEndDate?: Date; // When Ratmas concludes for the season
  timezone: string; // IANA timezone (e.g., "America/New_York")
  announcementChannelId?: string; // Optional channel for event announcements
}

/**
 * Main Ratmas event entity
 * Represents a single secret santa event for a Discord guild
 */
export interface RatmasEvent {
  id: string; // Unique event identifier
  guildId: string; // Discord guild/server ID
  status: RatmasEventStatus; // Current lifecycle state
  config: RatmasEventConfig; // Event configuration
  createdAt: Date; // When event was created
  updatedAt: Date; // Last modification time
}

/**
 * A participant in a Ratmas event
 * Links a Discord user to their participation in an event
 */
export interface RatmasParticipant {
  id: string; // Unique participant identifier
  eventId: string; // References RatmasEvent.id
  userId: string; // Discord user ID
  guildId: string; // Discord guild ID
  displayName: string; // User's display name at time of joining
  wishlistUrl?: string; // Optional Amazon/gift wishlist URL
  joinedAt: Date; // When user joined the event
  updatedAt: Date; // Last modification time
}

/**
 * A secret santa pairing assignment
 * Links a santa (giver) to their recipient
 * This data should be kept private - only the santa knows their recipient
 */
export interface RatmasPairing {
  id: string; // Unique pairing identifier
  eventId: string; // References RatmasEvent.id
  santaId: string; // Participant giving gifts (references RatmasParticipant.id)
  recipientId: string; // Participant receiving gifts (references RatmasParticipant.id)
  notifiedAt?: Date; // When the santa was notified via DM
  createdAt: Date; // When pairing was created
}

/**
 * Options for creating a new Ratmas event
 */
export interface CreateEventOptions {
  guildId: string;
  ratmasRoleId: string; // Discord role that identifies Ratmas participants
  eventStartDate: Date;
  purchaseDeadline: Date;
  revealDate: Date;
  eventEndDate: Date;
  timezone: string;
  announcementChannelId?: string;
}

/**
 * Options for updating participant information
 */
export interface UpdateParticipantOptions {
  displayName?: string;
  wishlistUrl?: string;
}

/**
 * Result of a pairing generation operation
 */
export interface PairingResult {
  success: boolean;
  pairingsCreated: number;
  error?: string;
}

/**
 * Information about event timing relative to current date
 */
export interface EventTiming {
  isActive: boolean;
  isPurchaseDeadlinePassed: boolean;
  daysUntilPurchaseDeadline: number;
  daysUntilReveal: number;
  daysUntilEnd?: number;
  currentDateInTimezone: Date;
}
