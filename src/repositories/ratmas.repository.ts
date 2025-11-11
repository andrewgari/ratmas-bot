import { prisma } from '../persistence/prisma-client.js';
import { RatmasEventStatus } from '../types/ratmas.types.js';
import type {
  CreateEventOptions,
  RatmasEvent,
  RatmasParticipant,
  RatmasPairing,
  UpdateParticipantOptions,
} from '../types/ratmas.types.js';

const ACTIVE_STATUSES: RatmasEventStatus[] = [
  RatmasEventStatus.OPEN,
  RatmasEventStatus.LOCKED,
  RatmasEventStatus.MATCHED,
  RatmasEventStatus.NOTIFIED,
];
const ACTIVE_STATUS_STRINGS = ACTIVE_STATUSES.map((status) => status as string);
const VALID_STATUS_VALUES = new Set<string>(Object.values(RatmasEventStatus));

type PrismaRatmasEvent = Awaited<ReturnType<typeof prisma.ratmasEvent.create>>;
type PrismaRatmasParticipant = Awaited<ReturnType<typeof prisma.ratmasParticipant.create>>;
type PrismaRatmasPairing = Awaited<ReturnType<typeof prisma.ratmasPairing.create>>;

export class RatmasRepository {
  constructor(private readonly client = prisma) {}

  async createEvent(options: CreateEventOptions): Promise<RatmasEvent> {
    const record = await this.client.ratmasEvent.create({
      data: {
        guildId: options.guildId,
        status: RatmasEventStatus.OPEN,
        ratmasRoleId: options.ratmasRoleId,
        eventStartDate: options.eventStartDate,
        purchaseDeadline: options.purchaseDeadline,
        revealDate: options.revealDate,
        timezone: options.timezone,
        announcementChannelId: options.announcementChannelId ?? null,
      },
    });

    return mapEvent(record);
  }

  async findEventById(eventId: string): Promise<RatmasEvent | null> {
    const record = await this.client.ratmasEvent.findUnique({ where: { id: eventId } });
    return record ? mapEvent(record) : null;
  }

  async findActiveEventByGuild(guildId: string): Promise<RatmasEvent | null> {
    const record = await this.client.ratmasEvent.findFirst({
      where: {
        guildId,
        status: { in: ACTIVE_STATUS_STRINGS },
      },
      orderBy: { createdAt: 'desc' },
    });

    return record ? mapEvent(record) : null;
  }

  async updateEventStatus(eventId: string, status: RatmasEventStatus): Promise<RatmasEvent> {
    const record = await this.client.ratmasEvent.update({
      where: { id: eventId },
      data: { status },
    });

    return mapEvent(record);
  }

  async replacePairings(eventId: string, pairings: RatmasPairing[]): Promise<void> {
    if (pairings.length === 0) {
      await this.client.ratmasPairing.deleteMany({ where: { eventId } });
      return;
    }

    await this.client.$transaction([
      this.client.ratmasPairing.deleteMany({ where: { eventId } }),
      this.client.ratmasPairing.createMany({
        data: pairings.map((pairing) => ({
          id: pairing.id,
          eventId: pairing.eventId,
          santaId: pairing.santaId,
          recipientId: pairing.recipientId,
          createdAt: pairing.createdAt,
          notifiedAt: pairing.notifiedAt ?? null,
        })),
      }),
    ]);
  }

  async listPairingsForEvent(eventId: string): Promise<RatmasPairing[]> {
    const records = await this.client.ratmasPairing.findMany({
      where: { eventId },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(mapPairing);
  }

  async findPairingForSanta(
    eventId: string,
    santaParticipantId: string
  ): Promise<RatmasPairing | null> {
    const record = await this.client.ratmasPairing.findFirst({
      where: {
        eventId,
        santaId: santaParticipantId,
      },
    });

    return record ? mapPairing(record) : null;
  }

  async markPairingsNotified(updates: { pairingId: string; notifiedAt: Date }[]): Promise<void> {
    if (updates.length === 0) return;

    await this.client.$transaction(
      updates.map((update) =>
        this.client.ratmasPairing.update({
          where: { id: update.pairingId },
          data: { notifiedAt: update.notifiedAt },
        })
      )
    );
  }

  async createParticipant(data: {
    eventId: string;
    userId: string;
    guildId: string;
    displayName: string;
    wishlistUrl?: string;
  }): Promise<RatmasParticipant> {
    const record = await this.client.ratmasParticipant.create({
      data: {
        eventId: data.eventId,
        userId: data.userId,
        guildId: data.guildId,
        displayName: data.displayName,
        wishlistUrl: data.wishlistUrl ?? null,
      },
    });

    return mapParticipant(record);
  }

  async deleteParticipant(participantId: string): Promise<void> {
    await this.client.ratmasParticipant.delete({ where: { id: participantId } });
  }

  async findParticipantById(participantId: string): Promise<RatmasParticipant | null> {
    const record = await this.client.ratmasParticipant.findUnique({ where: { id: participantId } });
    return record ? mapParticipant(record) : null;
  }

  async findParticipantByEventAndUser(
    eventId: string,
    userId: string
  ): Promise<RatmasParticipant | null> {
    const record = await this.client.ratmasParticipant.findUnique({
      where: {
        eventId_userId: {
          eventId,
          userId,
        },
      },
    });

    return record ? mapParticipant(record) : null;
  }

  async updateParticipant(
    participantId: string,
    updates: UpdateParticipantOptions
  ): Promise<RatmasParticipant> {
    const data: { displayName?: string; wishlistUrl?: string | null } = {};

    if (updates.displayName !== undefined) {
      data.displayName = updates.displayName;
    }

    if (updates.wishlistUrl !== undefined) {
      data.wishlistUrl = updates.wishlistUrl ?? null;
    }

    const record = await this.client.ratmasParticipant.update({
      where: { id: participantId },
      data,
    });

    return mapParticipant(record);
  }

  async listParticipants(eventId: string): Promise<RatmasParticipant[]> {
    const records = await this.client.ratmasParticipant.findMany({
      where: { eventId },
      orderBy: { joinedAt: 'asc' },
    });

    return records.map(mapParticipant);
  }
}

function mapEvent(record: PrismaRatmasEvent): RatmasEvent {
  const status = validateStatus(record.status);
  return {
    id: record.id,
    guildId: record.guildId,
    status,
    config: {
      ratmasRoleId: record.ratmasRoleId,
      eventStartDate: record.eventStartDate,
      purchaseDeadline: record.purchaseDeadline,
      revealDate: record.revealDate,
      timezone: record.timezone,
      announcementChannelId: record.announcementChannelId ?? undefined,
    },
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function mapParticipant(record: PrismaRatmasParticipant): RatmasParticipant {
  return {
    id: record.id,
    eventId: record.eventId,
    userId: record.userId,
    guildId: record.guildId,
    displayName: record.displayName,
    wishlistUrl: record.wishlistUrl ?? undefined,
    joinedAt: record.joinedAt,
    updatedAt: record.updatedAt,
  };
}

function mapPairing(record: PrismaRatmasPairing): RatmasPairing {
  return {
    id: record.id,
    eventId: record.eventId,
    santaId: record.santaId,
    recipientId: record.recipientId,
    createdAt: record.createdAt,
    notifiedAt: record.notifiedAt ?? undefined,
  };
}

function validateStatus(status: string): RatmasEventStatus {
  if (!VALID_STATUS_VALUES.has(status)) {
    throw new Error(`Encountered unknown Ratmas event status: ${status}`);
  }

  return status as RatmasEventStatus;
}
