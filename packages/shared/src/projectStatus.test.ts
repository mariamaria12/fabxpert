import test from 'node:test';
import assert from 'node:assert/strict';
import { isProjectAutoReadyForExecution } from './projectStatus';

test('isProjectAutoReadyForExecution shows a pinned project in production', () => {
  assert.equal(isProjectAutoReadyForExecution(true, 'IN_PRODUCTIE'), true);
});

test('isProjectAutoReadyForExecution hides a pinned project in any other status', () => {
  assert.equal(isProjectAutoReadyForExecution(true, 'IN_PREGATIRE'), false);
  assert.equal(isProjectAutoReadyForExecution(true, 'FINALIZAT'), false);
  assert.equal(isProjectAutoReadyForExecution(true, 'SUSPENDAT'), false);
});

test('isProjectAutoReadyForExecution hides an unpinned project whatever its status', () => {
  assert.equal(isProjectAutoReadyForExecution(false, 'IN_PRODUCTIE'), false);
  assert.equal(isProjectAutoReadyForExecution(false, 'IN_PREGATIRE'), false);
  assert.equal(isProjectAutoReadyForExecution(false, 'FINALIZAT'), false);
  assert.equal(isProjectAutoReadyForExecution(false, 'SUSPENDAT'), false);
});
