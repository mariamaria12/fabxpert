import test from 'node:test';
import assert from 'node:assert/strict';
import { countInclusiveLeaveDays } from './leaveDays';
import { isPublicHoliday, isWorkingDate, parseWorkDateString } from './workDate';

const day = (value: string) => parseWorkDateString(value);

function workingDaysInMonth(year: number, monthIndex: number): number {
  let count = 0;
  for (
    const cursor = new Date(year, monthIndex, 1);
    cursor.getMonth() === monthIndex;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    if (isWorkingDate(cursor)) {
      count += 1;
    }
  }
  return count;
}

test('the fixed public holidays are not working days', () => {
  for (const date of [
    '2026-01-01',
    '2026-01-02',
    '2026-01-06',
    '2026-01-07',
    '2026-05-01',
    '2026-11-30',
    '2026-12-01',
    '2026-12-25',
  ]) {
    assert.equal(isPublicHoliday(date), true, date);
    assert.equal(isWorkingDate(date), false, date);
  }
});

test('the moving holidays follow the orthodox easter', () => {
  // Paște 2026 is 12 April, so Vinerea Mare is the 10th and Rusalii 31 May–1 June.
  for (const date of ['2026-04-10', '2026-04-12', '2026-04-13', '2026-05-31', '2026-06-01']) {
    assert.equal(isPublicHoliday(date), true, date);
  }
  assert.equal(isPublicHoliday('2026-04-09'), false);
  assert.equal(isPublicHoliday('2026-04-14'), false);

  // Paște 2027 is 2 May.
  assert.equal(isPublicHoliday('2027-04-30'), true);
  assert.equal(isPublicHoliday('2027-05-02'), true);
  assert.equal(isPublicHoliday('2027-05-03'), true);
});

test('a holiday falling on a weekend gives nothing back', () => {
  // 15 August 2026 is a Saturday: the month keeps its 21 working days, the
  // number the pontaj for August 2026 was drawn with.
  assert.equal(isPublicHoliday('2026-08-15'), true);
  assert.equal(workingDaysInMonth(2026, 7), 21);
});

test('the months with holidays on a weekday lose them from the norm', () => {
  assert.equal(workingDaysInMonth(2026, 11), 21); // December: 1 and 25 fall Tue and Fri
  assert.equal(workingDaysInMonth(2027, 0), 18); // January: 1, 6 and 7 fall on weekdays
});

test('leave over a holiday does not spend a day on it', () => {
  // 30 November – 2 December 2026: only Wednesday the 2nd is a working day.
  assert.equal(countInclusiveLeaveDays(day('2026-11-30'), day('2026-12-02')), 1);
  assert.equal(countInclusiveLeaveDays(day('2026-11-23'), day('2026-11-25')), 3);
});
