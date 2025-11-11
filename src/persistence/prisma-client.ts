import { PrismaClient } from '@prisma/client';

type GlobalPrisma = PrismaClient | undefined;

const globalPrismaKey = '__ratmasPrisma';

const prisma =
  (globalThis as typeof globalThis & { __ratmasPrisma?: GlobalPrisma })[globalPrismaKey] ??
  new PrismaClient();

if (process.env['NODE_ENV'] !== 'production') {
  (globalThis as typeof globalThis & { __ratmasPrisma?: GlobalPrisma })[globalPrismaKey] = prisma;
}

export { prisma };
