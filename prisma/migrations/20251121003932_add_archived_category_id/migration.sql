-- CreateTable
CREATE TABLE "RatmasEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "ratmasRoleId" TEXT NOT NULL,
    "eventStartDate" DATETIME NOT NULL,
    "purchaseDeadline" DATETIME NOT NULL,
    "revealDate" DATETIME NOT NULL,
    "timezone" TEXT NOT NULL,
    "announcementChannelId" TEXT,
    "archivedCategoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RatmasParticipant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "wishlistUrl" TEXT,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RatmasParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RatmasEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RatmasPairing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "santaId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "notifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RatmasPairing_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RatmasEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatmasPairing_santaId_fkey" FOREIGN KEY ("santaId") REFERENCES "RatmasParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RatmasPairing_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "RatmasParticipant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RatmasEvent_guildId_idx" ON "RatmasEvent"("guildId");

-- CreateIndex
CREATE INDEX "RatmasEvent_status_idx" ON "RatmasEvent"("status");

-- CreateIndex
CREATE INDEX "RatmasParticipant_eventId_idx" ON "RatmasParticipant"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RatmasParticipant_eventId_userId_key" ON "RatmasParticipant"("eventId", "userId");

-- CreateIndex
CREATE INDEX "RatmasPairing_eventId_idx" ON "RatmasPairing"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "RatmasPairing_eventId_santaId_key" ON "RatmasPairing"("eventId", "santaId");

-- CreateIndex
CREATE UNIQUE INDEX "RatmasPairing_eventId_recipientId_key" ON "RatmasPairing"("eventId", "recipientId");
