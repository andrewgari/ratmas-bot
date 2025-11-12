# Copilot Instructions

## Codebase Snapshot

- `src/index.ts` boots the Discord client, wires slash-like message handlers, and composes the domain services (`UserService`, `MessageService`, `ChannelService`, `RoleService`); mirror this pattern when introducing new handlers.
- `src/services/rat.service.ts` owns Ratmas event lifecycle with persistence; it delegates status rules to `rat.service.helpers.ts`, pairing + DM orchestration to `rat.service.operations.ts`, and data access to `repositories/ratmas.repository.ts`.
- Prisma models live in `prisma/schema.prisma`; the shared client is exported from `src/persistence/prisma-client.ts` (reuse it, do not instantiate `PrismaClient` directly, especially in tests).
- Docs under `docs/*.md` explain intent for the split service architecture and persistence changes; consult `docs/ARCHITECTURE.md` and `docs/PERSISTENCE.md` before reshaping core flows.

## Architectural Patterns

- Services are narrow and injected with the Discord `Client`; add new Discord integrations by extending or composing these specialized services instead of reviving the legacy `DiscordService`.
- Domain types in `src/types/*.ts` mirror Prisma models; any schema change must update the enum/constants (`RatmasEventStatus`, `ACTIVE_STATUSES`) and downstream switch/guard logic.
- `RatService.generatePairings` expects at least three participants and persists through `replacePairings`; keep that transactional contract when altering pairing logic.
- `notifyAllPairings` defers DM content to `buildPairingNotificationMessage`; update that helper for copy changes so the DM + status progression (`MATCHED` → `NOTIFIED`) stays consistent.
- Environment-driven behaviour: `DISCORD_TOKEN` is mandatory for runtime, `DATABASE_URL` chooses the SQLite file, and guild/role gating comes from `.env` keys in `README.md`.

## Workflows & Tooling

- Node 20+ with ESM (`"type": "module"`) is required; always import local modules with explicit `.js` extensions.
- Install deps with `npm install`, run type-check/build via `npm run build`, lint with `npm run lint`, format using `npm run format:check` or `npm run format`.
- Tests run under Jest ESM mode: `npm test` injects `NODE_OPTIONS=--experimental-vm-modules`. Unit tests mock `discord.js` via `jest.unstable_mockModule`; follow that approach for new service tests.
- When touching Prisma schema, regenerate clients (`npm run prisma:generate`) and ensure migrations are captured (`npm run prisma:migrate:dev`).
- Local dev typically runs the compiled bot with `node dist/index.js` (or `tsx src/index.ts` if adding a script); align any new scripts with Docker + README expectations.

## Persistence & Data Flow

- `RatmasRepository` is the single gateway to Prisma; maintain mapping helpers (`mapEvent`, `mapParticipant`, etc.) and reuse `VALID_STATUS_VALUES` checks for guards.
- Pairings are replaced wholesale inside a transaction; never partially mutate pairing rows or you can desync Santa/recipient uniqueness guarantees from `schema.prisma`.
- Helper utilities (`shuffleArray`, `generateId`) are injectable to enable deterministic testing—pass alt shufflers in new code that needs reproducible results.

## Testing & Examples

- See `__tests__/index.test.ts` for how runtime boot is validated without hitting real Discord; spoof external calls and assert `process.exit`/console behaviour there.
- Prefer creating focused service tests beside existing helpers rather than end-to-end Discord calls; rely on the mapper utilities to shape fake Discord entities.

## Repo Hygiene

- Follow `CLAUDE.md`: avoid dropping helper files in repo root, store temp planning under `/temp/`, and keep infrastructure changes separate from gameplay/business logic.
- When adding documentation or operational guides, place them under `docs/` to stay consistent with current structure.
