# Database connection audit — Prisma + Supabase

**Date:** 2026-07-16  
**Backend:** NestJS (`apps/api`) on Railway (persistent process, not serverless)  
**ORM:** Prisma 5  
**DB:** Supabase Postgres via **session pooler** (`:5432`)

## Symptom

`FATAL: (EMAXCONNSESSION) max clients reached in session mode - max clients are limited to pool_size: 15`

Observed locally with few concurrent users — classic sign of **multiple PrismaClient instances** and/or **uncapped pool size**, not of organic load.

---

## Findings

### Critical (fixed)

| Issue | Location | Risk | Fix |
|-------|----------|------|-----|
| Nest `PrismaService` constructed as a normal provider (`new PrismaClient()` per app boot) with **no** `globalThis` cache and **no** `connection_limit` | historically `apps/api/src/prisma/prisma.service.ts` | Each Nest watch restart / overlapping process opened Prisma’s default pool (`~num_cpus*2+1`) against a 15-slot session pool | Singleton on `globalThis` + URL `connection_limit` injection (`prisma-client.singleton.ts`, `prisma-database-url.ts`) |

### Medium (fixed)

| Issue | Location | Risk | Fix |
|-------|----------|------|-----|
| No Nest shutdown hooks — `OnModuleDestroy` / `$disconnect` not triggered on SIGTERM | `apps/api/src/main.ts` | Deploy overlap: old instance kept sockets until hard kill | `app.enableShutdownHooks()` + disconnect on bootstrap failure |
| `@fabxpert/db` package export created an uncapped client, cached only in non-prod | `packages/db/src/index.ts` | Latent second pool if ever imported at runtime | Cap URL + always cache on `globalThis` |
| E2E helper opened a second uncapped client next to Nest | `apps/api/test/helpers/database.ts:11` | Suite + Nest could exhaust test DB pool | `connection_limit=1` on helper URL |
| Seeds opened uncapped short-lived clients | `packages/db/prisma/seed*.ts` | Parallel seed + API could tip the pool | Shared `createSeedPrismaClient()` with limit `1` (still `$disconnect` in `.finally`) |
| Docs never warned against transaction pooler `:6543` | `.env.example`, `DEPLOY.md` | Misconfiguration footgun with Prisma | Documented session-only + sizing formula |

### Minor / no change needed

| Issue | Location | Notes |
|-------|----------|-------|
| Single `$transaction` batch of project pin updates | `apps/api/src/project/project.service.ts:354` | DB-only updates; no external I/O while holding the connection |
| `$queryRaw` dashboard/summary queries | `timesheet-*.util.ts`, `timesheet.service.ts` | One-shot Prisma queries; not raw `pg` clients |
| SSE streams | `timesheet-events.service.ts`, `project-availability-events.service.ts` | In-memory Observables; do **not** hold DB connections |
| No `pg.Client` / `pg.Pool` usage | repo-wide | Prisma-only access |

---

## Instantiation map (`new PrismaClient`)

| File | Role | Cap | Disconnect |
|------|------|-----|------------|
| `apps/api/src/prisma/prisma-client.singleton.ts` | Nest runtime singleton | prod `5` / dev `2` | `OnModuleDestroy` + shutdown hooks |
| `packages/db/src/index.ts` | Package export (not used by API runtime) | same defaults | N/A (process exit) |
| `packages/db/prisma/create-seed-prisma.ts` | All seeds | `1` | `.finally` in each seed |
| `apps/api/test/helpers/database.ts` | E2E helper | `1` | `disconnectTestPrisma()` in global teardown |

---

## Root cause (most likely)

1. **Uncapped Nest Prisma pool** under `nest start --watch` / repeated restarts.  
2. **Supabase session pool size 15** shared with migrate/CLI/other leftovers.  
3. No graceful `$disconnect` on process signals → sockets released slowly.

Together these produced `EMAXCONNSESSION` long before “real” concurrent users mattered.

---

## Fixes applied

1. **Singleton Prisma client** for Nest (`globalThis.fabxpertPrisma`) via module `useFactory`.  
2. **Auto `connection_limit`** on `DATABASE_URL` (prod `5`, dev `2`) if missing.  
3. **`app.enableShutdownHooks()`** so SIGTERM/SIGINT run `prisma.$disconnect()`.  
4. **Capped seed + e2e helper clients** (`connection_limit=1`).  
5. **Hardened `@fabxpert/db` export** (cap + always cache).  
6. **Docs** — session pooler only; sizing formula in `DEPLOY.md` / `.env.example`.

Business query logic was not changed.

---

## Recommended `connection_limit`

Confirm the live limit in **Supabase → Settings → Database** (error text showed **15** for this project).

| Deploy shape | Recommended `connection_limit` per API instance |
|--------------|--------------------------------------------------|
| 1 Railway replica (current) | **5** (default injected in prod) |
| 2 replicas | **4** (`2 × 4 = 8 ≤ 15`, leave room for migrate/ops) |
| 3 replicas | **3** |

Formula:

```text
connection_limit_per_instance × max_replicas + ops_headroom ≤ supabase_session_pool_size
```

Keep ~3–5 slots free for `prisma migrate deploy`, one-off seeds, and Prisma Studio.

Optional override (takes precedence over the injected default):

```text
DATABASE_URL=postgresql://...:5432/postgres?connection_limit=5
```

---

## Verification checklist

- [x] Only one Nest Prisma client path (factory + singleton)  
- [x] `connection_limit` applied in API / db package / seeds / e2e helper  
- [x] Shutdown hooks enabled  
- [x] No unmanaged `pg` pools  
- [x] Session pooler `:5432` documented; `:6543` warned against  
- [ ] After deploy: watch Railway logs for `EMAXCONNSESSION` under normal load  
