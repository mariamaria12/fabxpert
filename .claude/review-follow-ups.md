# Code review follow-ups

Findings from the section-by-section code review that were left for later on
purpose. Each one needs a decision or a production check before it can be
fixed, so none of them is a quick edit. When one is done, delete its entry.

Sections: 1 Foundation and security · 2 Timesheets · 3 Overtime and leave ·
4 Projects, assemblies, panou · 5 Reports and accounting document ·
6 Mobile + impersonation · 7 Everything else.

Reviewed so far: 1, 2 and 3. Sections 4–7 have not been read yet — see
"Sections still to review" at the end.

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

## Section 3 — Overtime and leave (reviewed 4 Oct 2026)

Already fixed in that pass: typed reserves lost on reload and then approved as
0, an approval settling a different month than the table showed, gap filling
exporting on a stale approval, the over-balance warning counting the request
twice (and for the wrong year), impossible dates answering 500 on leave and on
resolve-days, the month closing before its document was built, the RECUPERARE
warning naming the wrong balance, and the "De plată la aprobare" tile losing
its sign.

### 🟡 The leave balance shown ignores the request's year

`LeaveReviewPanel.tsx` and `LeaveFormPanel.tsx` always fetch the current year's
balance (`GET /leave-requests/balance/:personId` has no `year`), then add or
subtract the request's `dayCount` whatever year it falls in. A request for
January seen in October reads "depășește soldul" against this year's days. The
API's warning now uses the request's year; the panels do not yet.

- Fix: a `year` parameter on the balance endpoint, fetched for
  `leaveRequestYear(startDate)`.
- Decide: a request spanning two years is counted whole in the year it starts
  (`leaveRequestYear`, a documented simplification). Keep or split.

### 🟡 A rejected request can be approved on top of another approved one

`LeaveService.review` does not run `assertNoOverlappingLeave`, and rejected
requests do not count as overlapping. Reject A, file and approve B for the same
days, then approve A: two approved leaves on the same days. ODIHNA days are
charged twice, and in overtime the day is credited twice (`leaveMinutesByDay`
adds). Not checked whether the UI offers approving a rejected request; the API
allows it.

- Decide: refuse, or approve and flag (the house rule is flag, not block).

### 🟡 Re-settling an older month does not reach months approved after it

`carriedInFor` reads the latest approval live and takes older ones as approved.
Re-settle August with a different reserve after September was approved, and
September's stored `carriedInMinutes` no longer matches August's
`carriedOutMinutes`: the difference is lost or counted twice. Same when August
is reapproved after September already took its change on. "Older approved
months stay frozen" is a decision; the reserve change is the part the UI still
allows.

- Decide: lock the reserve of a month that has a later approval, or walk the
  chain forward.

### 🟢 Smaller ones

- "Rămase acum" on an already approved ODIHNA adds the request's own days back
  (`LeaveReviewPanel.tsx`), and the panel shows no overtime balance before a
  RECUPERARE approval.
- Pending badges go stale: overtime after a manual correction or a reviewed
  RECUPERARE; leave when a request is filed from mobile.
- Timesheets on a deleted project still count for overtime and the accounting
  document (`loadOvertimeSource` uses `notDeleted()` only), but are hidden from
  the Pontaje list and its export.
- `resolveAccountingDays` writes day by day outside a transaction, and an
  unknown `personId` answers 500. Its `uuidSchema` also lacks the `p…` seed-id
  form every other schema accepts, so in dev a month with seed people cannot be
  exported.
- `countPendingApprovals` (the sidebar badge) groups the whole timesheet history
  on every read; `computeAllBalances` already bounds its scan with `scanFrom`.
- The accounting preview's "Zile" is `worked + leave + unpaid` and counts CO/CM
  only; the xlsx column is the month norm and also counts CP, DS and INV. "N
  gata pentru export" counts external collaborators; the total does not.
- `LeaveAllocationPanel` uses `parseInt`: "12.7" becomes 12.
- Dates a day early for actions between 00:00 and 03:00: "Revizuit" in the leave
  list and the request date on the docx (both slice a UTC timestamp).
- A past month viewed in the balances tab applies only the latest correction,
  so a month with an earlier one reads wrong once a later one exists.
- The leave list and leave calendar have no guard against an older response
  landing last; leave list filters fall back to none when one is invalid.

## Tests that fail for reasons of their own (seen 4 Oct 2026)

Found on a full `test:e2e` run; none of them is in code touched by the review.

- `panou-dashboard.e2e-spec.ts` › onLeaveCount: files a leave request for
  "today" and gets 400 on a weekend, because a request needs a working day.
  Passes or fails by the day of the week.
- `project-list-filter.e2e-spec.ts` › statusGroup: expects 2 projects in
  progress and gets 3. Looks like a fixture or the status reduction of 24 Sep
  that the test was not updated for.
- `authorization.e2e-spec.ts` › `/projects/available` fields: expects
  `code, color, company, id, name` only; the endpoint now also returns
  `denumireLucrare`, `finisaj` and `notes`, which the pontaj app uses.

## Sections still to review

Paused on 4 Oct 2026 after section 3. Same method as before: the API side read
in full, the web side by a second reader with its findings re-checked in code,
then fixes for what is local and an entry here for what needs a decision. Line
counts are from that day.

### Section 4 — Projects, assemblies, panou (about 11,800 lines)

- API: `apps/api/src/project`, `apps/api/src/assembly` (about 2,500).
- Web: `apps/web/app/(app)/projects`, `apps/web/app/(app)/panou` (about 9,300).
- Shared: `assemblyImport.ts`, `assemblyProgress.ts`, `progressCalibration.ts`,
  `projectComplexity.ts`, `projectStatus.ts`, `steelProfile.ts`, `finisaj.ts`.

Worth looking at first:

- Project visibility for employees (`project-visibility.util.ts`) and how
  "ready for execution" follows pin and status.
- The assembly import (text and workbook) and re-import over an existing list:
  rows matched by `(projectId, name)`, what happens to marks that disappear and
  to timesheets already linked to them.
- The progress formula and its calibration from delivered projects.
- Pinned order and panou columns under concurrent edits.
- Already seen from section 2: assembly progress does not exclude timesheets of
  a deleted person, while the hours beside it do.
- Two e2e specs here are already failing — see "Tests that fail for reasons of
  their own".

### Section 5 — Reports (about 3,650 lines)

- API: `apps/api/src/reports` (about 1,500).
- Web: `apps/web/app/(app)/reports` (about 2,200).
- Shared: `reportPeriod.ts`, `period.ts`, `periodDisplay.ts`.

Worth looking at first:

- Period boundaries, and that every report agrees with the Pontaje list for the
  same period (deleted persons and deleted projects are filtered differently in
  different queries).
- Estimated hours against logged hours — estimated hours are for the final
  comparison only, not a base for calculation.
- Whether reports should show weekend hours apart, now that overtime does.

The accounting document was reviewed with section 3.

### Section 6 — Mobile app and impersonation (about 15,500 lines)

- Mobile: `apps/mobile/src` (about 8,300).
- Impersonation: `apps/web/app/(app)/admin/impersonation` (about 7,200).

Worth looking at first:

- Diff every mobile file against its impersonation twin (the map is in
  `.claude/skills/impersonation-mirror/SKILL.md`) and list where they drifted.
- Double submit on the time entry and leave forms: the API has no idempotency,
  so a second tap creates a second entry.
- The lookup cache (`MobileLookupCacheContext`): stale projects and activities,
  and what a worker sees after an admin changes them.
- Offline and flaky network: what is lost when a save fails.
- The assembly picking flow against its UX rules.
- Push notifications and the service worker.
- `impersonationApi`: that every call really acts as the impersonated person
  and that writes are confirmed.

### Section 7 — Everything else (about 11,400 lines)

- API: `company`, `person`, `employee-role`, `poll`, `notification`, `activity`
  (about 1,900).
- Web: `admin` without impersonation, `companies`, `people`, and the shared
  `apps/web/components` (about 9,500).
- Shared: whatever sections 4–6 did not cover, and `packages/db` seeds and
  scripts.

Worth looking at first:

- The company import and the lookup "revive on create" helper.
- Polls: who may vote, voting after close, results visible to employees.
- Push subscriptions: pruning dead endpoints, a subscription moving between
  users on a shared phone.
- Deleting a person or an activity that timesheets still point at.
- Shared components everything leans on: `DataTable`, `SlideOverPanel`,
  `SearchableSelect`, `DateField`, `PeriodFilter`, the calendar.
- The seed scripts' guards against running on the wrong database.

### Cross-cutting, after the sections

- The timezone change described under section 2 (work dates as UTC midnight,
  "today" in `Europe/Bucharest`). It touches timesheets, leave and overtime, so
  it waits until section 4 and 5 have shown what else depends on it.
