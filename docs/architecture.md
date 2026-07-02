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

Next.js application.

Used by administrators and office employees.

Responsibilities:

- Dashboard
- Users
- People
- Companies
- Projects
- Timesheets
- Administration

---

# apps/mobile

The mobile application is dedicated exclusively to production employees.

For **V1**, this application will be implemented as a **Progressive Web App (PWA)**.

The reason for creating a separate application instead of integrating it into the web app is to keep a clear architectural separation and allow an easy migration to React Native in the future.

The folder structure will therefore remain stable:

```
apps/mobile
```

Later, the implementation can change from PWA to React Native without affecting the rest of the project.

---

# Mobile V1 Scope

Employee users can:

- Login
- View their own profile
- Start a timesheet
- Stop a timesheet
- View their own recent time entries

Nothing more.

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

Business definitions should never be duplicated.

---

# Authentication

Authentication is required for every application.

- Implemented **entirely inside the NestJS API** — Supabase Auth is not used.
- The web and mobile (PWA) applications will use **HTTP-only cookies** for session handling.
- Authentication should be implemented only once inside the API.

---

# Authorization

The MVP supports only two roles.

## ADMIN

Can manage:

- Users
- People
- Companies
- Projects
- Timesheets

Has full access.

---

## EMPLOYEE

Can access only the mobile application.

Can:

- Login
- View own profile
- Start timesheet
- Stop timesheet
- View own timesheets

Cannot access administration pages.

Authorization must always be enforced by the backend.

---

# Domain Model (MVP - conceptual, not final schema)

This section defines the core relationships between MVP entities so future implementation prompts don't need to re-derive them.

### User
- Represents a **login account** (credentials, role, auth state).
- Not every `Person` has a `User` (e.g. some employees may never need system access).

### Person
- Represents an **employee** (name, contact info, employment data).
- Relationship to `User`: **1:1, optional.** A `Person` *may* have an associated `User` account; a `User` always corresponds to exactly one `Person`.

### Company
- Represents a **client** — the beneficiary of a fabrication project (not a platform tenant, not a supplier/subcontractor in the MVP).

### Project
- Belongs to **exactly one `Company`** (the client). No multi-company association in the MVP (e.g. subcontractors) — this may be introduced later if needed.

### Timesheet
- Associated with a `Person` (who logged the time) and a `Project` (what the time was logged against).

> Note: exact field-level schema (columns, enums, constraints) will be defined in the implementation prompt for `packages/db`, not here. This section only fixes the relationships so they're not reinvented per-prompt.

---

# Database Strategy

The database should be designed for the long term.

Although the MVP implements only a few modules, entities should already be extensible enough to support future features.

Every entity should include standard audit fields:

- id (UUID)
- createdAt
- updatedAt
- deletedAt (where appropriate)

Relationships should be designed with future modules in mind.

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

# Open Items (deferred, not blocking MVP start)

These are acknowledged but intentionally deferred — not resolved here — so they don't block starting implementation prompts. They should be addressed when the relevant module is actually implemented:

- API response/error format conventions (envelope shape, pagination, naming case in API vs DB)
- Environment/config strategy (.env structure, dev/staging/prod)
- Testing strategy (unit/e2e coverage expectations for MVP)
- CI/CD and deployment target

---

# Goal

The objective of the MVP is **not** to build a complete ERP.

The objective is to validate the architecture, establish clean development patterns, and create a solid foundation that can be expanded incrementally into a complete fabrication management platform.

---

# Environments

FabXpert uses two environments: development and production. No staging environment for the MVP — speed is prioritized, with the tradeoff that migrations and changes are not tested in an intermediate environment before prod.

- **development** — used while building locally. Own Supabase project (fabxpert-dev). 
  DATABASE_URL is set in packages/db/.env (gitignored, never committed).
- **production** — the live environment. Own Supabase project (fabxpert-prod). 
  DATABASE_URL is set as an environment variable on the production host (not a local file).

There is no local database — "development" means running the apps locally against the 
cloud fabxpert-dev Supabase project, not a local Postgres instance.

Migrations:
- development: `prisma migrate dev` (generates and applies migration files)
- production: `prisma migrate deploy` (applies existing migration files only — never 
  generates new ones directly against prod)

---