-- Blood donation leave (DS on the pontaj accounting receives): a paid day off
-- that spends no balance.
-- The new enum value is only added here, never used in this migration, so it is
-- safe inside the migration transaction.

ALTER TYPE "LeaveType" ADD VALUE 'BLOOD_DONATION';
