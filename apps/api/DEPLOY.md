# Deploying apps/api to Railway

Monorepo strategy: **repo root** as Railway root directory, build via Turborepo (`--filter=@fabxpert/api...`), start via `@fabxpert/api` `start:prod`.

See the numbered checklist at the bottom of this file, `railway.json`, and `nixpacks.toml` at the repo root for pinned commands.

## Build pipeline

1. **Railpack setup** — Node **22** (`.nvmrc` / `.node-version` / `engines`; pnpm 11 requires Node ≥ 22.13)
2. **Install** — `corepack` + `pnpm install --frozen-lockfile` (Railpack auto-detects monorepo)
3. **Build** — `pnpm --filter @fabxpert/db db:generate && pnpm turbo build --filter=@fabxpert/api...` (from `railway.json`; Prisma types must exist before `nest build`)
4. **Start** — `pnpm --filter @fabxpert/api start:prod` (migrate deploy + `node dist/main`)

**Railway dashboard:** root directory `/`. Commands come from `railway.json` — do **not** override build/start unless you know why. If you must override:
- **Build:** `pnpm --filter @fabxpert/db db:generate && pnpm turbo build --filter=@fabxpert/api...`
- **Start:** `pnpm --filter @fabxpert/api start:prod`
- **Optional env:** `NIXPACKS_NODE_VERSION=22` only if you switch builder back to Nixpacks (`nixpacks.toml` fallback)

`DATABASE_URL` and `DIRECT_URL` must be set on Railway before build (Prisma reads them from the schema during `generate`; no DB connection is made).

Seeds are **never** run on deploy.

## CORS — `WEB_APP_URL` format

Comma-separated list of allowed origins (no spaces required, but trimmed):

```
WEB_APP_URL=https://app.fabxpert.ro,https://mobil.fabxpert.ro
```

Optional `MOBILE_APP_URL` adds one more origin (local dev: `http://localhost:3001`).

## Production seed (one-time, manual)

From your machine, with prod Supabase credentials:

```bash
DATABASE_URL="postgresql://..." \
DIRECT_URL="postgresql://..." \
ADMIN_SEED_EMAIL="you@company.ro" \
ADMIN_SEED_PASSWORD="your-strong-password" \
pnpm --filter @fabxpert/db db:seed:prod
```

Creates: 6 EmployeeRoles, 8 Activities, one ADMIN user. No demo companies/projects/timesheets.

Dev seed (full demo data) remains:

```bash
pnpm --filter @fabxpert/db db:seed:dev
# or: pnpm --filter @fabxpert/db db:seed
```

## SSE

`/timesheets/stream` and `/projects/available/stream` use NestJS `@Sse()`. No global compression middleware is enabled — SSE should work on Railway's persistent process. Do not add response compression without excluding these routes.

## Healthcheck

`GET /health` → `{ "status": "ok" }` (no auth). Railway `healthcheckPath`: `/health`.

---

## Manual deploy checklist

### 1. Supabase production database

1. Create Supabase project `fabxpert-prod`.
2. Copy **Session pooler** connection string (port **5432**, user `postgres.PROJECT_REF`) → `DATABASE_URL`.
3. Copy the **same Session pooler** string → `DIRECT_URL` (see IPv4 note below).
4. Do not run `migrate dev` against prod — Railway `start:prod` runs `migrate deploy`.

#### Railway + Supabase: P1001 / "Can't reach database server"

**Cause:** Supabase **direct** host `db.{ref}.supabase.co` is **IPv6-only** on the free tier. Railway **cannot reach IPv6** outbound ([Railway docs](https://docs.railway.com/reference/outbound-networking#outbound-ipv6)). `migrate deploy` uses `DIRECT_URL`, so a direct host fails at container start.

**Fix (recommended):** use **Session pooler (port 5432)** for **both** variables on Railway:

```text
DATABASE_URL=postgresql://postgres.icniqqtjchvfcixqkgku:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
DIRECT_URL=postgresql://postgres.icniqqtjchvfcixqkgku:PASSWORD@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
```

(Same pattern as local dev `DATABASE_URL` — pooler user `postgres.{ref}`, not `postgres@db.{ref}.supabase.co`.)

**Alternatives:** Supabase **IPv4 add-on** (paid) so `db.{ref}.supabase.co` works from Railway; or run `db:migrate:deploy` once from your laptop against prod, then only if you accept direct-host limitations.

**Also check:** project not **Paused** in Supabase; real DB password (not `[YOUR-PASSWORD]`); URL-encode special characters in password; no quotes around values in Railway Variables.

### 2. Railway project

1. New Railway project → **Deploy from GitHub repo**.
2. **Root Directory**: `/` (repository root, not `apps/api`).
3. Railway reads `railway.json` for build/start/healthcheck.
4. If overriding in dashboard:
   - **Install**: leave to Railpack auto-detect
   - **Build:** `pnpm --filter @fabxpert/db db:generate && pnpm turbo build --filter=@fabxpert/api...`
   - **Start:** `pnpm --filter @fabxpert/api start:prod`
5. **Node version**: 22 (from `.nvmrc` / `engines`; required for pnpm 11.5.2).

### 3. Railway environment variables

| Variable | Value source |
|----------|----------------|
| `DATABASE_URL` | Supabase prod **session pooler** `:5432` (`postgres.{ref}` user) |
| `DIRECT_URL` | **Same session pooler URL** on Railway (not `db.{ref}.supabase.co` — IPv6) |
| `JWT_SECRET` | Generate random 64+ byte secret |
| `JWT_REMEMBER_EXPIRY_ADMIN` | `30d` |
| `JWT_REMEMBER_EXPIRY_EMPLOYEE` | `365d` |
| `JWT_SESSION_EXPIRY` | `1d` |
| `WEB_APP_URL` | `https://app.fabxpert.ro,https://mobil.fabxpert.ro` (your real Vercel URLs) |
| `NODE_ENV` | `production` |

Do **not** set: `TEST_DATABASE_URL`, `TEST_DIRECT_URL`, `TEST_USERS_SEED_PASSWORD`, `EMPLOYEE_SEED_*`, seed passwords on Railway.

`MOBILE_APP_URL` optional if both frontends are in `WEB_APP_URL`.

`PORT` is injected by Railway — do not set manually.

### 4. First deploy

Push to connected branch. On start, logs should show Prisma `migrate deploy` applying migrations, then `API running on...`.

### 5. One-time prod seed

Run the `db:seed:prod` command above from your local machine against prod DB.

### 6. Railway public domain

Generate domain in Railway → Settings → Networking (e.g. `fabxpert-api-production.up.railway.app` or custom domain).

Verify: `curl https://YOUR-RAILWAY-DOMAIN/health`

### 7. Connect frontends

- **apps/web** (Vercel): `NEXT_PUBLIC_API_URL=https://YOUR-RAILWAY-DOMAIN`
- **apps/mobile** (Vercel): `VITE_API_URL=/api` — requests go through `apps/mobile/vercel.json` rewrite to Railway (same-origin cookies; required on mobile Safari). Do **not** point mobile directly at the Railway URL in production.
- Ensure `WEB_APP_URL` on Railway lists both Vercel frontend origins exactly (scheme + host, no trailing slash).
