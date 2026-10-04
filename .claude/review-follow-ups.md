# Code review follow-ups

Findings from the section-by-section code review that were left for later on
purpose. Each one needs a decision or a production check before it can be
fixed, so none of them is a quick edit. When one is done, delete its entry.

Sections: 1 Foundation and security · 2 Timesheets · 3 Overtime and leave ·
4 Projects, assemblies, panou · 5 Reports and accounting document ·
6 Mobile + impersonation · 7 Everything else.

## Section 1 — Foundation and security (reviewed 4 Oct 2026)

Already fixed in that pass: deleted accounts could still sign in, the login
timing leak, the unvalidated login body, email capitalisation on new accounts,
and the unparsable `DATABASE_URL` crash at startup.

### 🟡 No attempt limit on login

`POST /auth/login` can be tried without limit — there is no throttler in the API.

- Fix: `@nestjs/throttler` on the login route.
- Decide first: the thresholds, and how the real client IP is read behind the
  Vercel `/api` proxy and Railway. Without that every user shares one IP and
  they all get locked out together.

### 🟡 Auth cookie is `SameSite=None` in production

`authCookieOptions` in `apps/api/src/auth/auth.service.ts` sets `None` for
cross-origin use, but web and mobile now go through the same-origin `/api`
proxy. With `None`, another site can submit a form POST carrying the admin's
cookie; Nest parses urlencoded bodies and CORS does not stop the request from
running. Reach is limited to POST routes with no body or a strings-only body
(forced logout, creating companies/activities).

- Fix: `SameSite=Lax`, or an `Origin` check on non-GET requests.
- Check first: that all production traffic, web and mobile, really goes
  through `/api`. If any client still calls Railway directly, `Lax` signs
  everyone on it out.

### 🟡 Changing a password does not end existing sessions

Tokens are stateless and an employee's lasts 365 days; logout only clears the
cookie. A lost phone stays signed in after a password reset — deactivating the
account is the only way out today.

- Fix: a `tokenVersion` column on `User`, put in the JWT and compared in
  `JwtStrategy`; bumped on password change (and on logout, if wanted).
- Needs: a migration.

### 🟡 Existing emails are not lowercased

New and edited accounts are stored lowercase and login ignores capitals in what
is typed, but an account saved earlier with capitals still only signs in when
the address is typed exactly as stored.

- Fix: a migration running `UPDATE users SET email = lower(trim(email))`, then
  drop the "as typed" fallback in `AuthService.login`.
- Check first, on production: no two accounts differ only by capitals. The
  migration runs on deploy and a unique violation would fail it.

### 🟢 `RolesGuard` allows by default

A route with no `@Roles` is open to any signed-in user
(`apps/api/src/auth/guards/roles.guard.ts`). Every controller has a class-level
`@Roles` today except notifications (intended) and auth, but a new controller
that forgets it is open to employees.

- Fix: deny when no roles are declared, and mark the "any signed-in user"
  routes explicitly.

### 🟢 Dead `sub` fallback in `CurrentUser`

`apps/api/src/auth/decorators/current-user.decorator.ts` falls back to
`request.user.sub`, which `JwtStrategy` never sets. Cosmetic.

### 🟢 Typecheck errors in stream e2e specs

`pnpm --filter @fabxpert/api typecheck` reports 8 errors, all in
`project-availability-stream`, `project-role-visibility` and `timesheet-stream`
e2e specs (supertest stream types, unused `res`). They predate the review.

### Unexplained

The new "login with a missing or non-text field → 400" test got a 404 once, on
its first run, and has passed on every run since with no code change. Worth a
look if it shows up again.

## Section 2 — Timesheets (reviewed 4 Oct 2026)

Already fixed in that pass: the day panel wiping assemblies while the activity
lookup was not loaded, marks lost after a project change in the day panel,
notes that could not be cleared, a half-saved day leaving the list stale, edits
refused once the entry's activity or project was retired, an impossible date
answering 500, lookups asking for 500 rows of a 200-row page, and the calendar
showing an older response.

### 🟡 Work dates depend on the server's timezone

A work date is stored as "server-local midnight" (`packages/shared/src/workDate.ts`),
and "today" is taken from the server's clock.

Confirmed on 4 Oct 2026: the Railway service has no `TZ` variable, and every
`workDate` in production reads `00:00:00` — production runs on UTC and stores
UTC midnight. A machine on Romanian time stores the same day as `21:00Z` of the
day before, which is why the xlsx export is a day early in local dev (measured).

What is wrong in production today: between 00:00 and 03:00 Romanian time (02:00
in winter) the server's "today" is still yesterday — the `today` period, "nu au
pontat azi" and the default date of an entry.

- Fix, storage: always build and read a work date as UTC midnight (`Date.UTC`,
  `getUTC*`), whatever the server's timezone. Production data already has this
  shape, so no production migration. The dev database holds `21:00Z`/`22:00Z`
  rows and needs correcting or re-seeding.
- Fix, "today": compute it explicitly in `Europe/Bucharest` — the app is only
  used in Romania — in one place, instead of from the server clock.
- Do not set `TZ=Europe/Bucharest` on Railway as a shortcut: new rows would
  stop grouping with existing ones for the same day, and "nu au pontat" compares
  the date exactly.
- Scope: `workDate.ts` is shared with leave and overtime, so do this as its own
  task after section 3 has been reviewed. A Postgres `DATE` column is the
  cleaner long-term shape but needs a migration on every table that holds a day.

### 🟢 Export preview rounds hours differently from the file

`formatExportHours` in `apps/web/app/(app)/timesheets/timesheetFormat.ts` uses
`toFixed(1)`: 7h45 reads "7.8" in the preview and 7.75 in the xlsx. Same for the
total.

### 🟢 "Nu au pontat" edge cases (`timesheet-not-logged.util.ts`)

- A person whose user account was deleted, but who is still a person, counts as
  "no account" and is listed as missing every day; a deactivated account is left
  out. Decide which of the two a leaver should be.
- A person added mid-month is listed as missing the days before they existed —
  `persons.createdAt` is not looked at.

### 🟢 Deleting a person hides their hours but not their pieces

`visibleTimesheetWhere` and the summary queries drop timesheets of a deleted
person, so project totals and exports shrink when someone who left is deleted.
The assembly progress queries do not make that join, so the pieces stay. Confirm
which is intended; if hours should stay, people who leave should be deactivated,
not deleted.

### 🟢 One invalid list filter drops all of them

`parseListFilters` in `timesheet.controller.ts` falls back to `{}` when any one
of personId / projectId / activityId / createdAt fails to parse, so a malformed
`personId` on the export returns everyone's entries. Answer 400 instead.

### 🟢 Smaller ones

- Logging time for any day dismisses the "n-ai pontat azi" reminder
  (`dismissTimesheetRemindersForPerson` ignores the work date).
- `GET /timesheets/grouped` with no period aggregates and sorts the whole
  history in memory on every page request.
- `durationMinutes` has no upper bound; "7,5h" and "1.5h" are rejected by
  `parseDurationMinutesInput`, and "0.001" returns 0 instead of null.
- `TimesheetListTab` can stay on "loading" if a reload starts while a load is in
  flight (`reloadLoadedPages` bumps the generation and skips the other's
  `finally`).
- The calendar filters a linked person by name text, not by id, so namesakes
  match (`TimesheetListTab.tsx`, where it passes the search to the calendar).

## Section 3 — Overtime and leave (not reviewed yet)

Found while reading the timesheets folder, which also holds the overtime and
accounting tabs. To be confirmed and ranked when section 3 is reviewed.

- **Typed reserves are lost on reload, then approved as 0** —
  `OvertimeApprovalsTab.tsx`, `loadPreview` rebuilds `reserves` from settled
  lines only. After approving one person the other "Păstrate" fields empty, and
  "Aprobă toate" sends 0 for each, paying out the whole balance.
- The approvals tab and the accounting tab have no guard against a slower,
  older response landing last, so the table can show one month while the action
  posts for another.
- The accounting preview counts CO/CM days only; the xlsx also counts CP and DS.
- "N gata pentru export" counts external collaborators; the total beside it
  does not.
