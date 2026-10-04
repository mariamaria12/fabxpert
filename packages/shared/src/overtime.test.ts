import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_WORK_MINUTES,
  SATURDAY_WORK_MINUTES,
  accountingHours,
  approvedMonthCarry,
  countSaturdaysAndHolidaysWorked,
  countSaturdaysWorked,
  dailyWorkMinutesOf,
  overtimeBalanceMinutes,
  overtimeDaysAvailable,
  settleOvertimeBalance,
  weekendMinutes,
} from './overtime';

/** How the months approved before weekend hours were counted apart are read. */
const LEGACY = { weekendInBalance: true };

const workingDay = (loggedMinutes: number, leaveMinutes = 0) => ({
  loggedMinutes,
  leaveMinutes,
  isWorkingDay: true,
});

test('a finished working day counts what it is over or short of the norm', () => {
  assert.equal(overtimeBalanceMinutes([workingDay(600)]), 60);
  assert.equal(overtimeBalanceMinutes([workingDay(DAILY_WORK_MINUTES)]), 0);
  assert.equal(overtimeBalanceMinutes([workingDay(480)]), -60);
});

test("a working day is measured against the person's own norm", () => {
  // 6h contract: seven hours is +1h, five is −1h.
  assert.equal(overtimeBalanceMinutes([workingDay(420)], 360), 60);
  assert.equal(overtimeBalanceMinutes([workingDay(360)], 360), 0);
  assert.equal(overtimeBalanceMinutes([workingDay(300)], 360), -60);
});

test('without a norm of their own a person is on the default 9h day', () => {
  assert.equal(dailyWorkMinutesOf(null), DAILY_WORK_MINUTES);
  assert.equal(dailyWorkMinutesOf(undefined), DAILY_WORK_MINUTES);
  assert.equal(dailyWorkMinutesOf(360), 360);
});

test('weekend and public holiday hours add nothing to the balance', () => {
  const saturday = { loggedMinutes: 540, isWorkingDay: false, isSaturday: true };
  const sunday = { loggedMinutes: 240, isWorkingDay: false, isSunday: true };
  const holiday = { loggedMinutes: 360, isWorkingDay: false };

  assert.equal(overtimeBalanceMinutes([saturday, sunday, holiday]), 0);
  // They do not pay a short week back either.
  assert.equal(overtimeBalanceMinutes([saturday, workingDay(480)]), -60);
});

test('weekend hours are counted as logged: saturdays with holidays, sundays apart', () => {
  const days = [
    { loggedMinutes: 540, isWorkingDay: false, isSaturday: true },
    { loggedMinutes: 120, isWorkingDay: false, isSaturday: true },
    // A public holiday in the week goes with the Saturdays.
    { loggedMinutes: 360, isWorkingDay: false },
    { loggedMinutes: 240, isWorkingDay: false, isSunday: true },
    // Easter Sunday is a public holiday and still a Sunday.
    { loggedMinutes: 60, isWorkingDay: false, isSunday: true },
    workingDay(600),
  ];

  assert.deepEqual(weekendMinutes(days), { saturdayMinutes: 1020, sundayMinutes: 300 });
  assert.equal(countSaturdaysAndHolidaysWorked(days), 3);
});

test('legacy: a saturday stays a 7.5h day whatever the norm', () => {
  const saturday = { loggedMinutes: 540, isWorkingDay: false, isSaturday: true };
  assert.equal(overtimeBalanceMinutes([saturday], 360, LEGACY), 90);
});

test("a day off from the balance costs a day of the person's norm", () => {
  assert.equal(overtimeDaysAvailable(720, 360), 2);
  assert.equal(overtimeDaysAvailable(720), 1);
});

test('legacy: sunday work is overtime hour for hour', () => {
  assert.equal(
    overtimeBalanceMinutes(
      [{ loggedMinutes: 240, isWorkingDay: false, isSunday: true }],
      DAILY_WORK_MINUTES,
      LEGACY,
    ),
    240,
  );
});

test('legacy: a saturday is a 7.5h day, only what is logged past it is overtime', () => {
  const saturday = (loggedMinutes: number) => ({
    loggedMinutes,
    isWorkingDay: false,
    isSaturday: true,
  });

  const legacy = (days: Parameters<typeof overtimeBalanceMinutes>[0]) =>
    overtimeBalanceMinutes(days, DAILY_WORK_MINUTES, LEGACY);

  assert.equal(legacy([saturday(240)]), 0);
  assert.equal(legacy([saturday(SATURDAY_WORK_MINUTES)]), 0);
  assert.equal(legacy([saturday(540)]), 90);
  // A short Saturday is never a debt.
  assert.equal(legacy([saturday(60), workingDay(DAILY_WORK_MINUTES)]), 0);
});

test('every saturday with time logged is a worked saturday, however short', () => {
  assert.equal(
    countSaturdaysWorked([
      { loggedMinutes: 60, isWorkingDay: false, isSaturday: true },
      { loggedMinutes: 540, isWorkingDay: false, isSaturday: true },
      { loggedMinutes: 0, isWorkingDay: false, isSaturday: true },
      { loggedMinutes: 300, isWorkingDay: false },
      workingDay(540),
    ]),
    2,
  );
});

test('leave covering a day is credited so it does not read as a short day', () => {
  assert.equal(overtimeBalanceMinutes([workingDay(480, 60)]), 0);
});

test('today cannot owe: pontaje logged so far never lower the balance', () => {
  const inProgress = (loggedMinutes: number) => ({
    loggedMinutes,
    isWorkingDay: true,
    isInProgress: true,
  });

  // The first pontaj of the morning used to open a full 9h debt, so logging
  // 2h dropped the balance by 7h and it climbed back over the day.
  assert.equal(overtimeBalanceMinutes([inProgress(120)]), 0);
  assert.equal(overtimeBalanceMinutes([inProgress(300)]), 0);
  assert.equal(overtimeBalanceMinutes([inProgress(DAILY_WORK_MINUTES)]), 0);
});

test('today still earns whatever is logged past the norm', () => {
  assert.equal(
    overtimeBalanceMinutes([{ loggedMinutes: 660, isWorkingDay: true, isInProgress: true }]),
    120,
  );
});

test('adding a pontaj to today never lowers the running balance', () => {
  const past = [workingDay(240), workingDay(120)];
  const before = overtimeBalanceMinutes(past);

  for (const logged of [30, 120, 300, DAILY_WORK_MINUTES]) {
    const after = overtimeBalanceMinutes([
      ...past,
      { loggedMinutes: logged, isWorkingDay: true, isInProgress: true },
    ]);
    assert.ok(after >= before, `logging ${logged}min today lowered the balance`);
  }
});

test('a settled month pays the whole balance by default', () => {
  assert.deepEqual(settleOvertimeBalance(600), {
    paidMinutes: 600,
    carriedOutMinutes: 0,
  });
});

test('a reserve is kept back instead of paid', () => {
  assert.deepEqual(settleOvertimeBalance(600, 240), {
    paidMinutes: 360,
    carriedOutMinutes: 240,
  });
  // You cannot keep more than you earned.
  assert.deepEqual(settleOvertimeBalance(600, 900), {
    paidMinutes: 0,
    carriedOutMinutes: 600,
  });
});

test('a debt is carried whole, never paid', () => {
  assert.deepEqual(settleOvertimeBalance(-420), {
    paidMinutes: 0,
    carriedOutMinutes: -420,
  });
  // A reserve is meaningless against a debt and must not turn into a payment.
  assert.deepEqual(settleOvertimeBalance(-420, 240), {
    paidMinutes: 0,
    carriedOutMinutes: -420,
  });
});

test('settling holds carriedIn + earned − used = paid + carriedOut', () => {
  const cases = [
    { carriedIn: 0, earned: 600, used: 0, reserve: 0 },
    { carriedIn: 120, earned: 600, used: 540, reserve: 60 },
    { carriedIn: -300, earned: 120, used: 0, reserve: 0 },
    { carriedIn: -300, earned: 900, used: 60, reserve: 5400 },
  ];

  for (const { carriedIn, earned, used, reserve } of cases) {
    const balance = carriedIn + earned - used;
    const { paidMinutes, carriedOutMinutes } = settleOvertimeBalance(balance, reserve);
    assert.equal(paidMinutes + carriedOutMinutes, balance);
    assert.ok(paidMinutes >= 0, 'a payout is never negative');
  }
});

test('an approved month with nothing new carries what it was approved with', () => {
  const approved = { earnedMinutes: 240, usedMinutes: 0, carriedOutMinutes: 60 };
  assert.equal(approvedMonthCarry(approved, { earnedMinutes: 240, usedMinutes: 0 }), 60);
});

test('hours logged after an early approval ride along with the carry', () => {
  // Approved at +4h with 1h kept; two more hours logged before the month ended.
  const approved = { earnedMinutes: 240, usedMinutes: 0, carriedOutMinutes: 60 };
  assert.equal(approvedMonthCarry(approved, { earnedMinutes: 360, usedMinutes: 0 }), 180);
});

test('time off or hours taken back after the approval come off the carry', () => {
  const approved = { earnedMinutes: 240, usedMinutes: 0, carriedOutMinutes: 60 };
  assert.equal(approvedMonthCarry(approved, { earnedMinutes: 240, usedMinutes: 60 }), 0);
  // A pontaj cut by 3h after 3h were paid: the person now owes 2h.
  assert.equal(approvedMonthCarry(approved, { earnedMinutes: 60, usedMinutes: 0 }), -120);
});

test('accounting splits a month into normal hours and the overtime approved for pay', () => {
  // 180h logged, 12h of it over the norm, all 12h approved.
  assert.deepEqual(
    accountingHours({ loggedMinutes: 10800, earnedMinutes: 720, paidMinutes: 720 }),
    { normalMinutes: 10080, overtimeMinutes: 720, totalMinutes: 10800 },
  );
});

test('weekend hours are not normal hours on the pontaj', () => {
  // 180h logged: 12h of them on a Saturday and a Sunday, 4h over the norm in the week.
  assert.deepEqual(
    accountingHours({
      loggedMinutes: 10800,
      weekendMinutes: 720,
      earnedMinutes: 240,
      paidMinutes: 240,
    }),
    { normalMinutes: 9840, overtimeMinutes: 240, totalMinutes: 10080 },
  );
});

test('unapproved overtime never reaches accounting', () => {
  assert.deepEqual(
    accountingHours({ loggedMinutes: 10800, earnedMinutes: 720, paidMinutes: null }),
    { normalMinutes: 10080, overtimeMinutes: 0, totalMinutes: 10080 },
  );
});

test('a short month is paid for what was logged, with nothing over it', () => {
  assert.deepEqual(
    accountingHours({ loggedMinutes: 9000, earnedMinutes: -1080, paidMinutes: 0 }),
    { normalMinutes: 9000, overtimeMinutes: 0, totalMinutes: 9000 },
  );
});

test('a reserve kept back is not on the pontaj, but a carried-in payout is', () => {
  // 6h earned, 2h kept as reserve: 4h paid.
  assert.equal(
    accountingHours({ loggedMinutes: 10440, earnedMinutes: 360, paidMinutes: 240 }).totalMinutes,
    10320,
  );
  // 3h earned plus 5h carried in from last month, all paid: total goes past logged.
  assert.equal(
    accountingHours({ loggedMinutes: 10260, earnedMinutes: 180, paidMinutes: 480 }).totalMinutes,
    10560,
  );
});
