import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_WORK_MINUTES,
  overtimeBalanceMinutes,
  settleOvertimeBalance,
} from './overtime';

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

test('weekend work is overtime hour for hour', () => {
  assert.equal(
    overtimeBalanceMinutes([{ loggedMinutes: 240, isWorkingDay: false }]),
    240,
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
