import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeProgressCalibration,
  PROGRESS_CALIBRATION_BOUNDS,
  sharesForActivities,
  type ProgressCalibrationSample,
} from './progressCalibration';

const bounds = PROGRESS_CALIBRATION_BOUNDS;

/** A project whose hours follow hours = a × kg + b × pieces exactly. */
function project(kg: number, pieces: number, a: number, b: number): ProgressCalibrationSample {
  const hours = a * kg + b * pieces;
  return { weightKg: kg, pieces, minutesByActivity: { weld: hours * 60 * 0.75, paint: hours * 60 * 0.25 } };
}

describe('computeProgressCalibration', () => {
  it('keeps the defaults without enough delivered projects', () => {
    const result = computeProgressCalibration([project(10_000, 50, 0.02, 1.5)], ['weld', 'paint']);
    assert.equal(result.fixedWeightKg, bounds.fixedWeightKg.fallback);
    assert.equal(result.fixedWeightFromData, false);
    assert.equal(result.activityWeightsFromData, false);
    assert.deepEqual(result.activityWeights, { weld: 0.5, paint: 0.5 });
  });

  it('recovers the cost of a piece from projects with different pieces per ton', () => {
    // a = 0.02 h/kg, b = 1.6 h/piece → 80 kg per piece.
    const samples = [10, 20, 40, 60, 80, 120, 160, 200].map((pieces, index) =>
      project(8_000 + index * 3_000, pieces, 0.02, 1.6),
    );
    const result = computeProgressCalibration(samples, ['weld', 'paint']);
    assert.equal(result.fixedWeightFromData, true);
    assert.ok(Math.abs(result.fixedWeightKg - 80) < 0.001);
  });

  it('holds the cost of a piece inside its band', () => {
    const samples = [10, 20, 40, 60, 80, 120, 160, 200].map((pieces, index) =>
      project(8_000 + index * 3_000, pieces, 0.01, 5),
    );
    const result = computeProgressCalibration(samples, ['weld', 'paint']);
    assert.equal(result.fixedWeightKg, bounds.fixedWeightKg.max);
  });

  it('leaves out a project pontaged only for accounting', () => {
    const real = [1, 2, 3].map(() => project(10_000, 50, 0.02, 1.5));
    const accounting: ProgressCalibrationSample = {
      weightKg: 50_000,
      pieces: 10,
      minutesByActivity: { weld: 60 },
    };
    const result = computeProgressCalibration([...real, accounting], ['weld', 'paint']);
    assert.equal(result.projectCount, 3);
    assert.equal(result.excludedProjectCount, 1);
  });

  it('splits shares by the median hours per ton, held inside the band', () => {
    const samples = [1, 2, 3].map(() => project(10_000, 50, 0.02, 1.5));
    const result = computeProgressCalibration(samples, ['weld', 'paint']);
    assert.equal(result.activityWeightsFromData, true);
    // Welding carries 75% of the hours, but no activity may carry more than 60%.
    assert.ok(Math.abs(result.activityWeights.weld - bounds.activityShare.max) < 1e-9);
    assert.ok(Math.abs(result.activityWeights.paint - 0.4) < 1e-9);
  });
});

describe('sharesForActivities', () => {
  it('gives an activity added later the average share, then rescales', () => {
    const shares = sharesForActivities({ weld: 0.6, paint: 0.4 }, ['weld', 'paint', 'fit']);
    assert.ok(Math.abs(shares.fit - 0.5 / 1.5) < 1e-9);
    assert.ok(Math.abs(shares.weld + shares.paint + shares.fit - 1) < 1e-9);
  });
});
