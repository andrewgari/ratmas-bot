/*
  Warnings:

  - You are about to drop the column `timezone` on the `RatmasEvent` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RatmasEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "ratmasRoleId" TEXT NOT NULL,
    "eventStartDate" DATETIME NOT NULL,
    "purchaseDeadline" DATETIME NOT NULL,
    "revealDate" DATETIME NOT NULL,
    "eventEndDate" DATETIME,
    "announcementChannelId" TEXT,
    "archivedCategoryId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_RatmasEvent" ("announcementChannelId", "archivedCategoryId", "createdAt", "eventEndDate", "eventStartDate", "guildId", "id", "purchaseDeadline", "ratmasRoleId", "revealDate", "status", "updatedAt") SELECT "announcementChannelId", "archivedCategoryId", "createdAt", "eventEndDate", "eventStartDate", "guildId", "id", "purchaseDeadline", "ratmasRoleId", "revealDate", "status", "updatedAt" FROM "RatmasEvent";
DROP TABLE "RatmasEvent";
ALTER TABLE "new_RatmasEvent" RENAME TO "RatmasEvent";
CREATE INDEX "RatmasEvent_guildId_idx" ON "RatmasEvent"("guildId");
CREATE INDEX "RatmasEvent_status_idx" ON "RatmasEvent"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
