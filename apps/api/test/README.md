# API E2E Tests

End-to-end tests for `apps/api` using Jest, `@nestjs/testing`, and supertest against a **real Postgres database**.

## Database setup (required)

Set `TEST_DATABASE_URL` in `apps/api/.env` (see `.env.example`). This must point to a **dedicated test database** — options:

- A separate local Postgres database (recommended for local dev)
- A separate Supabase project
- A dedicated schema on the same host (e.g. append `?schema=fabxpert_e2e` to the connection string)

**Never** use the same URL as `DATABASE_URL` (dev data). The test runner **refuses to start** if `TEST_DATABASE_URL` is missing or equals `DATABASE_URL`.

Optionally set `TEST_DIRECT_URL` for `prisma migrate deploy` (defaults to `TEST_DATABASE_URL`).

## Running

```bash
pnpm --filter @fabxpert/shared build   # if shared dist is stale
pnpm --filter @fabxpert/api test:e2e
```

Or from the repo root via Turbo:

```bash
pnpm turbo run test:e2e --filter=@fabxpert/api
```

## What runs

1. **Global setup** — validates env, runs `prisma migrate deploy` against the test DB
2. **Per test file** — truncates all tables, re-seeds minimal fixtures (order-independent between files)
3. **Four suites** — auth, authorization matrix, timesheet cross-module rules, user security

Fixtures are created in `test/helpers/fixtures.ts`, not the dev `prisma/seed.ts`.
