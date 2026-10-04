import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compareTasksByUrgency,
  formatTaskCount,
  formatTaskDueDate,
  taskDueState,
  taskNeedsAttention,
} from './tasks';

// A Wednesday, so the week ends on Sunday the 11th.
const TODAY = '2026-10-07';

test('taskDueState reads the deadline against today', () => {
  assert.equal(taskDueState({ dueDate: null, status: 'TODO' }, TODAY), 'none');
  assert.equal(taskDueState({ dueDate: '2026-10-06', status: 'TODO' }, TODAY), 'overdue');
  assert.equal(taskDueState({ dueDate: '2026-10-07', status: 'IN_PROGRESS' }, TODAY), 'today');
  assert.equal(taskDueState({ dueDate: '2026-10-08', status: 'TODO' }, TODAY), 'tomorrow');
  assert.equal(taskDueState({ dueDate: '2026-10-11', status: 'TODO' }, TODAY), 'thisWeek');
  assert.equal(taskDueState({ dueDate: '2026-10-12', status: 'TODO' }, TODAY), 'later');
});

test('a finished task is never overdue', () => {
  const done = { dueDate: '2026-09-01', status: 'DONE' } as const;
  assert.equal(taskDueState(done, TODAY), 'later');
  assert.equal(taskNeedsAttention(done, TODAY), false);
});

test('on a Sunday the week ends that day', () => {
  assert.equal(taskDueState({ dueDate: '2026-10-12', status: 'TODO' }, '2026-10-11'), 'tomorrow');
  assert.equal(taskDueState({ dueDate: '2026-10-13', status: 'TODO' }, '2026-10-11'), 'later');
});

test('formatTaskDueDate names the days around today', () => {
  assert.equal(formatTaskDueDate('2026-10-06', TODAY), 'Ieri');
  assert.equal(formatTaskDueDate('2026-10-07', TODAY), 'Azi');
  assert.equal(formatTaskDueDate('2026-10-08', TODAY), 'Mâine');
  assert.match(formatTaskDueDate('2026-10-20', TODAY), /^20 oct/);
  assert.match(formatTaskDueDate('2027-01-05', TODAY), /2027/);
});

test('compareTasksByUrgency puts the earliest deadline first and no deadline last', () => {
  const tasks = [
    { id: 'none', dueDate: null, status: 'TODO', priority: 'URGENT' },
    { id: 'later', dueDate: '2026-10-20', status: 'TODO', priority: 'NORMAL' },
    { id: 'soon-normal', dueDate: '2026-10-08', status: 'TODO', priority: 'NORMAL' },
    { id: 'soon-urgent', dueDate: '2026-10-08', status: 'TODO', priority: 'URGENT' },
  ] as const;
  const sorted = [...tasks].sort(compareTasksByUrgency).map((task) => task.id);
  assert.deepEqual(sorted, ['soon-urgent', 'soon-normal', 'later', 'none']);
});

test('formatTaskCount follows the Romanian plural', () => {
  assert.equal(formatTaskCount(1), '1 task');
  assert.equal(formatTaskCount(5), '5 task-uri');
  assert.equal(formatTaskCount(19), '19 task-uri');
  assert.equal(formatTaskCount(20), '20 de task-uri');
  assert.equal(formatTaskCount(101), '101 task-uri');
});
