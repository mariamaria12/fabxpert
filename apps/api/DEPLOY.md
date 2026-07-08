# Deploying apps/api to Railway

Monorepo strategy: **repo root** as Railway root directory, build via Turborepo (`--filter=@fabxpert/api...`), start via `@fabxpert/api` `start:prod`.

See the numbered checklist at the bottom of this file and `railway.json` at the repo root for pinned commands.

## Build pipeline

1. `pnpm install --frozen-lockfile` — runs `@fabxpert/db` **postinstall** (`prisma generate`)
2. `pnpm turbo build --filter=@fabxpert/api...` — runs `@fabxpert/db#generate` (uncached), workspace builds, then `@fabxpert/api` `prebuild`/`build`
3. `pnpm --filter @fabxpert/api start:prod` — runs `prisma migrate deploy` then `node dist/main.js`

**Railway dashboard:** use the commands from `railway.json` at repo root. If you overrode them manually:
- **Build:** `corepack enable && pnpm install --frozen-lockfile && pnpm turbo build --filter=@fabxpert/api...`  
  (or `pnpm --filter @fabxpert/api build` — both work; `prebuild` runs `db:generate` before `nest build`)
- **Start:** `pnpm --filter @fabxpert/api start:prod` — **not** `start` (dev) or bare `node dist/main` without migrations

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
2. Copy **Session pooler** connection string → `DATABASE_URL`.
3. Copy **Direct** (or session pooler on newer projects) connection string → `DIRECT_URL`.
4. Do not run `migrate dev` against prod — Railway `start:prod` runs `migrate deploy`.

### 2. Railway project

1. New Railway project → **Deploy from GitHub repo**.
2. **Root Directory**: `/` (repository root, not `apps/api`).
3. Railway reads `railway.json` for build/start/healthcheck.
4. If overriding in dashboard:
   - **Install**: `corepack enable && pnpm install --frozen-lockfile`
   - **Build**: `pnpm turbo build --filter=@fabxpert/api...`
   - **Start**: `pnpm --filter @fabxpert/api start:prod`
5. **Node version**: 20 (from `.nvmrc` / `engines`).

### 3. Railway environment variables

| Variable | Value source |
|----------|----------------|
| `DATABASE_URL` | Supabase prod session pooler |
| `DIRECT_URL` | Supabase prod direct / migrate URL |
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
- **apps/mobile** (Vercel): `VITE_API_URL=https://YOUR-RAILWAY-DOMAIN` (confirm env name in mobile app)
- Ensure `WEB_APP_URL` on Railway lists both Vercel frontend origins exactly (scheme + host, no trailing slash).
