-- Overtime stops being a lifetime running total and becomes a monthly ledger.
-- Hours are recovered as time off or paid at month end, so a month now closes
-- to a payout plus whatever is deliberately carried on: a reserve when
-- positive, a debt still to be worked back when negative.
--
-- The invariant every row holds is
--   carriedIn + earned − used = paid + carriedOut

ALTER TABLE "overtime_accruals" RENAME TO "overtime_settlements";

ALTER TABLE "overtime_settlements" RENAME CONSTRAINT "overtime_accruals_pkey" TO "overtime_settlements_pkey";
ALTER TABLE "overtime_settlements" RENAME CONSTRAINT "overtime_accruals_personId_fkey" TO "overtime_settlements_personId_fkey";
ALTER INDEX "overtime_accruals_personId_month_key" RENAME TO "overtime_settlements_personId_month_key";
ALTER INDEX "overtime_accruals_personId_idx" RENAME TO "overtime_settlements_personId_idx";

ALTER TABLE "overtime_settlements" RENAME COLUMN "closedAt" TO "settledAt";

ALTER TABLE "overtime_settlements"
    ADD COLUMN "carriedInMinutes"  INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "usedMinutes"       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "paidMinutes"       INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "carriedOutMinutes" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "settledByUserId"   TEXT;

ALTER TABLE "overtime_settlements" ADD CONSTRAINT "overtime_settlements_settledByUserId_fkey"
    FOREIGN KEY ("settledByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill. Positive balances built up before the ledger existed are treated as
-- already settled outside the app and are dropped, so nobody is paid twice.
-- Debts are real and carry, so they land on each person's last settled month
-- and flow forward from there. Months before that one carry nothing.
--
-- The RECUPERARE subquery mirrors countInclusiveLeaveDays: an inclusive day
-- range with Saturday and Sunday excluded, or the stored minutes when the
-- request was made in hours.
WITH recuperare AS (
    SELECT
        lr."personId",
        SUM(
            COALESCE(
                lr."durationMinutes",
                (
                    SELECT COUNT(*) * 540
                    FROM generate_series(lr."startDate"::date, lr."endDate"::date, INTERVAL '1 day') AS d
                    WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
                )
            )
        )::int AS minutes
    FROM "leave_requests" lr
    WHERE lr."type" = 'RECUPERARE'
      AND lr."status" = 'APROBAT'
      AND lr."deletedAt" IS NULL
    GROUP BY lr."personId"
),
balance AS (
    SELECT
        s."personId",
        (SUM(s."earnedMinutes") - COALESCE(MAX(r.minutes), 0))::int AS minutes,
        MAX(s."month") AS "lastMonth"
    FROM "overtime_settlements" s
    LEFT JOIN recuperare r ON r."personId" = s."personId"
    GROUP BY s."personId"
)
UPDATE "overtime_settlements" t
SET "carriedOutMinutes" = LEAST(b.minutes, 0)
FROM balance b
WHERE t."personId" = b."personId"
  AND t."month" = b."lastMonth";
