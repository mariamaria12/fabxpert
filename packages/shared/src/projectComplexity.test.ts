import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatProjectComplexity, projectComplexityLevel } from './projectComplexity';

describe('projectComplexityLevel', () => {
  it('grades parts per ton into the four classes', () => {
    assert.equal(projectComplexityLevel(0), 1);
    assert.equal(projectComplexityLevel(35), 1);
    assert.equal(projectComplexityLevel(90), 2);
    assert.equal(projectComplexityLevel(220), 3);
    assert.equal(projectComplexityLevel(480), 4);
  });

  it('keeps each upper bound in its own class', () => {
    assert.equal(projectComplexityLevel(50), 1);
    assert.equal(projectComplexityLevel(50.1), 2);
    assert.equal(projectComplexityLevel(150), 2);
    assert.equal(projectComplexityLevel(300), 3);
    assert.equal(projectComplexityLevel(300.5), 4);
  });

  it('has no class while the figure is missing or unusable', () => {
    assert.equal(projectComplexityLevel(null), null);
    assert.equal(projectComplexityLevel(undefined), null);
    assert.equal(projectComplexityLevel(-1), null);
    assert.equal(projectComplexityLevel(Number.NaN), null);
  });
});

describe('formatProjectComplexity', () => {
  it('labels the class the way the shop says it', () => {
    assert.equal(formatProjectComplexity(1), 'C1');
    assert.equal(formatProjectComplexity(4), 'C4');
  });
});
