# FabXpert - Project Architecture & Development Strategy

## Vision

FabXpert is a modern ERP platform for steel fabrication companies.

The long-term goal is to build a complete system capable of managing every aspect of a fabrication company, from project management to production, inventory, shipping and reporting.

FabXpert is inspired by Tekla PowerFab but is **not intended to be a clone**. The objective is to build a modern, intuitive and scalable platform with a significantly better user experience.

---

# Development Strategy

The project will be developed incrementally.

We will first define the long-term architecture and create an extensible database model, but we will **only implement what is required for the MVP**.

Every entity should be designed so it can evolve without requiring breaking changes later.

The codebase should always remain simple, clean and easy to extend.

---

# Tenancy Model

**FabXpert is single-tenant.** One instance of the system is used by one fabrication company.

This means:
- No `tenant_id` / organization-scoping is required across entities.
- `Company` (see Domain Model below) refers to **clients**, not to tenants of the platform.
- Should multi-tenancy ever become a requirement, it will be introduced as a deliberate future migration, not designed for prematurely.

---

# MVP Scope

The MVP is intentionally very small.

Only the following modules will be implemented:

- Authentication
- Users
- People (Employees)
- Companies (Clients)
- Projects
- Timesheets
- EmployeeRole (admin-managed lookup)
- Activity (admin-managed lookup)

No additional business modules should be implemented until the MVP is complete.

The following modules are explicitly out of scope:

- Production
- Inventory
- Drawings
- Assemblies
- Parts
- CNC / NC Files
- Shipping
- Purchasing
- Accounting
- Quotations
- Reports
- Notifications
- AI features

The goal of the MVP is to validate the architecture, authentication, permissions and the complete CRUD flow.

---

# Applications

The project is organized as a **Turborepo monorepo**, managed with **pnpm** (pnpm workspaces).

```
fabxpert/
    apps/
        api/
        web/
        mobile/
    packages/
        db/
        shared/
```

---

# apps/api

**NestJS** application, exposing a **REST API**.

REST was chosen over GraphQL for the MVP: the module set is small, CRUD-oriented, and REST keeps the learning curve and boilerplate low for both the Next.js web app and the PWA mobile app. GraphQL can be reconsidered later if aggregation-heavy modules (e.g. reporting, dashboards) make it worthwhile.

Responsibilities:

- Authentication
- Authorization
- Business logic
- CRUD operations
- Validation
- Database access

Validation is done with **Zod** schemas (shared between API and frontends via `packages/shared` where practical).

---

# apps/web

Next.js application (App Router).

Used by administrators and office employees.

Responsibilities:

- Dashboard
- Users
- People
- Companies
- Projects
- Timesheets
- Employee roles & Activities (lookup administration)
- Administration

**Styling:** Tailwind CSS, configured to consume the color tokens defined in `packages/shared/styles/tokens.css` (see Shared Packages below) rather than hardcoded hex values. This keeps theming (e.g. a future light theme) a matter of editing the shared token file, not touching components.

**Visual direction:** industrial/technical, dark-mode-first, data-dense. See the design tokens in `packages/shared/styles/tokens.css` for the concrete palette (background, surface, text, accent, and per-status colors for `ProjectStatus`).

---

# apps/mobile

The mobile application is dedicated exclusively to production employees.

For **V1**, this application will be implemented as a **Progressive Web App (PWA)**, built with **Vite + React** (not Next.js).

Rationale: apps/mobile has no need for server-side rendering, server routing, or SEO — every screen is behind a login and purely client-side (form inputs, selections, API calls). Next.js's server-oriented features would add unused complexity and friction with PWA tooling. Vite is a lightweight build tool (not a framework) that compiles React/TypeScript into optimized static assets, keeping the app minimal and fast on mobile networks. PWA capabilities (manifest, service worker, offline caching) are provided via **vite-plugin-pwa**.

The reason for creating a separate application instead of integrating it into the web app is to keep a clear architectural separation and allow an easy migration to React Native in the future.

The folder structure will therefore remain stable:

```
apps/mobile
```

Later, the implementation can change from Vite+React (PWA) to React Native without affecting the rest of the project. Note: this migration rewrites the UI layer regardless of which web-based tool was used, so choosing Vite over Next.js now costs nothing at that point.

---

# Mobile V1 Scope

What shipped in the mobile PWA (employee flow):

1. **Login** — remember-me default on; ADMIN accounts are rejected with an inline message (web-only).
2. **Project selection** — execution-ready projects only (`/projects/available`); cards tinted with project color; **today's total** banner (sum of today's closed entries, page-1 MVP) opens **My timesheets**.
3. **Activity selection** — required in the UI flow (activity is optional in the API schema).
4. **Duration-based manual entry** — user enters hours worked; frontend converts to a closed interval `[now − X hours, now]` via `createTimesheet`. Whole-hour stepper (1–16), half-hour precision via free typing; quick presets 2/4/6/8h; optional notes.
5. **My timesheets** — paginated list grouped by calendar day (local time); day totals; tap today's entries to edit.
6. **Edit/delete today only (UI rule)** — older entries are read-only in mobile; edit adjusts duration (keeping original `startTime`, shifting `endTime`) and notes; delete uses footer confirmation. **Not enforced server-side** — post-MVP editing of older entries is planned, so PATCH/DELETE remain unrestricted by date for an employee's own rows.
7. **Toast notifications** — centralized success/error feedback for save/edit/delete operations (inline errors kept for form validation and list retry blocks).

**Live timer:** a start/stop timer was built, then **removed from the mobile UI**. API endpoints `POST /timesheets/start` and `POST /timesheets/stop` remain; they are currently unused by any client. API cleanup is deferred (see Open Items).

**Navigation:** persistent header (wordmark resets flow); contextual sub-header on project/activity/time-entry steps; back arrows clear selections.

Nothing else (no admin, no profile screen, no offline queue).

---

# Shared Packages

## packages/db

Contains:

- Prisma schema
- Prisma Client
- Database migrations
- Seed scripts

The database schema is the single source of truth.

**Database provider: Supabase (Postgres).**

Supabase is used **only as managed Postgres hosting** for this MVP — accessed via a standard connection string through Prisma. Supabase Auth, Storage, Realtime, and Row Level Security are **not** used in the MVP.

Rationale: keeping all business logic and authentication inside the NestJS API (per the Authentication and Development Principles sections below) avoids splitting auth/authorization logic across two systems. Supabase Storage may be adopted later for file-heavy modules (e.g. Drawings), as a deliberate future decision — not by default.

---

## packages/shared

Contains code shared between all applications:

- DTOs
- Enums
- Types
- Validation schemas (Zod)
- Utility functions
- Constants
- `src/api/` — a framework-agnostic, typed HTTP client layer (`client.ts` for the base request/error handling, `auth.ts` for auth-specific functions like `login`, `logout`, `getMe`, etc.). This is the **only** place that talks to `apps/api` directly — no app (`apps/web`, `apps/mobile`) should call `fetch` on API endpoints directly. The client is configured once at each app's startup via `configureApiClient(baseUrl)`, reading that app's own env var (e.g. `NEXT_PUBLIC_API_URL`) — the shared package itself never reads env vars directly, so it stays reusable across Next.js and Vite apps alike.
- `styles/tokens.css` — the color token system (CSS custom properties) consumed by `apps/web` via Tailwind and by `apps/mobile` directly. Single source of truth for the palette; supports adding a future theme (e.g. light mode) as an override block without touching consuming components.

Business definitions should never be duplicated.

---

# Authentication

Authentication is required for every application.

- Implemented **entirely inside the NestJS API** — Supabase Auth is not used.
- The web and mobile (PWA) applications use **HTTP-only cookies** for session handling (`access_token`).
- Authentication is implemented once inside the API; frontends call `packages/shared` auth helpers only.

**Remember-me:** login accepts `rememberMe`. When true, JWT expiry is role-specific (`JWT_REMEMBER_EXPIRY_ADMIN`, default 30d; `JWT_REMEMBER_EXPIRY_EMPLOYEE`, default 365d) and the cookie gets a matching `maxAge`. When false, a shorter session expiry (`JWT_SESSION_EXPIRY`, default 1d) is used with a session cookie (no `maxAge`). Mobile defaults remember-me on in the login UI.

**Per-request validation (deliberate deviation from pure stateless JWT):** after JWT signature/expiry checks, `JwtStrategy.validate` reloads the user from the database and rejects the request if `isActive` is false. This makes account deactivation take effect immediately without waiting for token expiry. Login uses the same `isActive` check and a generic `Invalid credentials` message (with constant-time password compare) to avoid user enumeration.

---

# Authorization

The MVP supports only two roles: **ADMIN** and **EMPLOYEE**.

Authorization is enforced globally via `AuthGuard` + `RolesGuard` on `apps/api`; route handlers declare allowed roles with `@Roles(...)`.

## ADMIN

Full access to all REST modules:

- Users, People, Companies, Projects, Timesheets (paginated admin list + CRUD)
- EmployeeRole and Activity lookup CRUD
- All timesheet operations, including on behalf of others (`personId` in request body where supported)

---

## EMPLOYEE

**Web:** cannot use administration pages (mobile-only role in product terms; enforced by not shipping employee web UI).

**Mobile/API self-service:**

| Endpoint | Access |
|----------|--------|
| `GET /projects/available` | Execution-ready projects only (`readyForExecution=true`), reduced DTO (id, name, code, color) |
| `GET /activities`, `GET /employee-roles` | Active rows only; `?includeInactive=true` is ignored (ADMIN-only filter) |
| Timesheets | Create closed entries (`POST /timesheets`), list own (`GET /timesheets/mine`), get/patch/delete **own** entries (ownership via linked `Person.id`); `personId` is **never** accepted from employee requests — always resolved server-side from the authenticated user |
| `POST /timesheets/start`, `POST /timesheets/stop` | Still exposed on the API (built for live timer); **unused by mobile V1** after timer UI removal |

Employees cannot access admin list endpoints (`GET /projects`, `GET /timesheets`, user/person/company CRUD, etc.).

Ownership failures return **403**; invalid/inaccessible ids return **404** (including soft-deleted rows).

---

# Domain Model (MVP)

Field-level schema lives in `packages/db/prisma/schema.prisma`. Below captures entities, key fields, and relationships as implemented.

### Soft delete (all entities)

Every entity has `deletedAt`. **Reads** spread `notDeleted()` (`deletedAt: null`) into Prisma queries. **Deletes** are soft everywhere (set `deletedAt`, never hard-delete in MVP modules).

Standard audit fields on all entities: `id` (UUID), `createdAt`, `updatedAt`, `deletedAt`.

---

### EmployeeRole

Admin-managed lookup (not a compile-time enum). Fields: `name` (unique), `isActive`, audit fields. Referenced optionally by `Person.employeeRoleId`.

---

### Activity

Same pattern as EmployeeRole, plus optional `color` (hex `#RRGGBB`). Referenced optionally by `Timesheet.activityId`. Seeded with distinct colors for mobile activity dots.

---

### Person

Employee record: `firstName`, `lastName` required; `email`, `phone` optional. Optional FK `employeeRoleId` → `EmployeeRole`.

**User relationship:** 1:1 optional from Person's side (`Person.user` may be null); **required** from User's side (`User.personId` unique). Not every Person has login access.

---

### User

Login account: `email` (unique), `passwordHash`, `role` (`ADMIN` | `EMPLOYEE`), `isActive` (default true), required unique `personId` → `Person`. Deactivation via `isActive=false`; soft delete via `deletedAt`.

---

### Company

Client (beneficiary of projects, not a platform tenant). `name` required; optional: `taxCode`, `tradeRegistryNumber`, `registeredAddress`, `phone`, `deliveryAddress`, `legalRepresentative`, `email`, `contactPerson`, `contactPersonPhone`.

---

### Project

Belongs to one `Company`. `name`, `code` (unique, manually assigned), `status` (`ProjectStatus` enum — 10 values from `CIORNA` through `ANULAT`), optional `dueDate`, `readyForExecution` (default false — gates employee visibility), optional `color` (hex). Employees see only `readyForExecution=true` projects via `/projects/available`.

---

### Timesheet

- `personId` — **whose time** is logged (subject).
- `userId` — **who entered** the record (actor; may differ when admin logs on behalf).
- `projectId` — required.
- `activityId` — optional.
- `startTime` — required.
- `endTime` — optional (nullable for open entries; mobile V1 always creates closed entries).
- `notes` — optional.

At most one open timesheet (`endTime IS NULL`) per person (API enforces on start/manual create).

---

> Relationship summary unchanged in intent: Project → Company (many-to-one); Timesheet → Person + Project (+ optional Activity); User → Person (1:1).

---

# Database Strategy

The database should be designed for the long term.

Although the MVP implements only a few modules, entities should already be extensible enough to support future features.

Every entity should include standard audit fields (see Domain Model — all entities use UUID `id`, timestamps, and soft delete).

Relationships should be designed with future modules in mind.

---

# Environments

FabXpert uses two environments: development and production. No staging environment for the MVP — speed is prioritized, with the tradeoff that migrations and changes are not tested in an intermediate environment before prod.

- **development** — used while building locally. Own Supabase project (`fabxpert-dev`).
  `DATABASE_URL` is set in `packages/db/.env` (gitignored, never committed).
- **production** — the live environment. Own Supabase project (`fabxpert-prod`).
  `DATABASE_URL` is set as an environment variable on the production host (not a local file).
  Not provisioned yet — will be created closer to the ship date once the Supabase plan is upgraded.

There is no local database — "development" means running the apps locally against the cloud `fabxpert-dev` Supabase project, not a local Postgres instance.

Migrations:
- development: `prisma migrate dev` (generates and applies migration files)
- production: `prisma migrate deploy` (applies existing migration files only — never generates new ones directly against prod)

---

# Deployment

- **apps/web** → **Vercel**. Native Next.js support, zero-config monorepo detection (root directory set to `apps/web`).
- **apps/mobile** → **Vercel**, as a *separate* Vercel project from apps/web (root directory set to `apps/mobile`), each with its own domain (e.g. `app.fabxpert.ro` for web, a subdomain for the mobile PWA). Kept separate rather than combined into one deploy, consistent with the architectural separation described in the apps/mobile section (independent migration path to React Native later).
- **apps/api** → **Railway**. Chosen over serverless/edge platforms because NestJS + Prisma benefit from a persistent process and stable long-lived database connections, rather than cold-starting a connection on every request. Railway deploys from the **monorepo root** (see `railway.json` and `apps/api/DEPLOY.md`), with environment variables (`DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET`, `WEB_APP_URL` for CORS, etc.) managed per environment through its dashboard.
- **Database** → Supabase (Postgres), per the Environments section above — `fabxpert-dev` now, `fabxpert-prod` provisioned shortly before the production deploy.

Each environment (development, production) has its own full set of deployed services (Vercel projects + Railway service + Supabase project) with matching env vars — no environment shares a database or API deployment with another.

---

# Development Principles

- Keep the MVP small.
- Don't build features before they are needed.
- Prefer simple solutions.
- Avoid premature optimization.
- Design for future extensibility.
- Keep business logic inside the API.
- Keep the frontend as thin as possible.
- Avoid duplicated code.
- Use strict TypeScript.
- Prefer composition over complexity.

---

# Future Roadmap

After the MVP is stable, future modules may include:

- Production
- Production Workflows
- Assemblies
- Parts
- Drawings
- CNC Files
- Inventory
- Shipping
- Purchasing
- Reporting
- Document Generation
- Integrations
- Mobile React Native application
- Multi-tenancy (if ever required)
- Supabase Storage / Auth adoption (if ever required)

These modules are intentionally postponed until the core architecture has been validated.

---

# API Conventions

Shared patterns for `apps/api` REST endpoints. Module-specific prompts should follow these rather than inventing per-resource variants.

## List endpoints (pagination)

All collection/list endpoints accept standard query parameters:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | 1-indexed page number |
| `pageSize` | number | `20` | Rows per page |

Example: `GET /projects?page=2&pageSize=20`

### List response envelope

Every paginated list endpoint returns the same shape:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "total": 142,
    "totalPages": 8
  }
}
```

- `data` — rows for the requested page only (already sliced server-side).
- `meta.total` — total row count across all pages (for pagination UI).
- `meta.totalPages` — `ceil(total / pageSize)`; minimum `1` when `total` is `0`.

The web app's `DataTable` and `Pagination` components are designed to work with this envelope: the parent page fetches with `page`/`pageSize`, passes `data` to `DataTable`, and passes `meta.page`, `meta.pageSize`, and `meta.total` to `Pagination`.

### Unpaginated list exceptions

Some read endpoints return a **plain array** (no `{ data, meta }` envelope) by design:

| Endpoint | Notes |
|----------|--------|
| `GET /activities` | Lookup list; active-only for EMPLOYEE |
| `GET /employee-roles` | Lookup list; active-only for EMPLOYEE |
| `GET /projects/available` | Reduced project DTO array for mobile |

All other collection endpoints use pagination.

## Error conventions (in use)

| Status | Typical use |
|--------|-------------|
| **400** | Zod validation failures; referential/business rule violations (e.g. invalid interval, project not execution-ready) |
| **401** | Missing/invalid cookie; inactive user; failed login (generic message) |
| **403** | Authenticated but wrong role; timesheet ownership violation |
| **404** | Entity not found or soft-deleted |
| **409** | Unique constraint conflicts (e.g. duplicate name/code/email) |

Login always returns the same generic **401** message for wrong password, unknown email, or inactive account (anti-enumeration).

Non-list response envelopes (single-resource shape, error body format) remain open — see Open Items.

---

# Testing

The MVP uses **API-level end-to-end tests** only (no unit-test coverage target for MVP modules).

- **Stack:** Jest + `@nestjs/testing` + supertest — full `AppModule` bootstrapped per suite, HTTP requests against the real NestJS pipeline.
- **Database:** Tests run against a **dedicated Postgres database** via `TEST_DATABASE_URL` (see `apps/api/test/README.md`). Prisma migrations are applied before the suite; fixtures are seeded in setup. **Never** point tests at dev or production data.
- **Priority:** Authorization rules (401/403 matrix), auth flows, and **cross-module business rules** (e.g. timesheet ↔ project/activity/person junctions). Basic CRUD happy paths are not exhaustively tested per field — rules and junctions are the focus.
- **Execution:** `pnpm --filter @fabxpert/api test:e2e` (on demand; not part of the default build pipeline).

---

# Open Items (deferred, not blocking MVP)

Acknowledged gaps — address when the relevant work is prioritized:

- **Table sorting** — deferred by explicit decision; list endpoints return default ordering only (no `sortBy` query param yet).
- **Non-list response/error envelope** — single-resource endpoints return the DTO directly; no unified `{ data, error }` wrapper.
- **CI/CD pipeline** — deployment targets are decided (see Deployment); deploys are manual for MVP.
- **PWA assets** — manifest/icons are placeholders; production-quality icons deferred.
- **Timer API cleanup** — `POST /timesheets/start|stop` remain after mobile timer removal; remove or repurpose once post-MVP direction is validated.
- **Night-shift / timezone edge cases** — mobile "today" grouping and banner totals use device local calendar day; cross-midnight and TZ quirks noted, not solved in MVP.
- **Auth vs soft-delete** — JWT validation checks `isActive` but does not yet filter `User.deletedAt`; user soft-delete currently sets `deletedAt` only (rely on admin process or follow-up hardening if needed).

---

# Goal

The objective of the MVP is **not** to build a complete ERP.

The objective is to validate the architecture, establish clean development patterns, and create a solid foundation that can be expanded incrementally into a complete fabrication management platform.