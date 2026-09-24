/**
 * The two figures the project progress formula runs on — kilograms each piece
 * adds on top of its weight, and each activity's share — worked out from
 * delivered projects. Every figure is held inside a fixed band, so a handful of
 * odd projects can nudge the formula but never swing it.
 */
export const PROGRESS_CALIBRATION_BOUNDS = {
  fixedWeightKg: { min: 25, max: 150, fallback: 75 },
  /**
   * Hours per ton on the tracked activities a delivered project must land in
   * to be used at all. Below it the hours were never really pontaged — a
   * project kept for accounting — and above it the weight is wrong.
   */
  projectHoursPerTon: { min: 5, max: 150 },
  /** Share of the progress one activity may carry. */
  activityShare: { min: 0.1, max: 0.6 },
  /** Fewer usable projects than this and the defaults stand. */
  minProjectsForFixedWeight: 8,
  minProjectsForActivityWeights: 3,
} as const;

export type ProgressCalibrationSample = {
  /** Project weight in kilograms. */
  weightKg: number | null;
  /** Pieces on the assembly list; null without a list or with lines missing a weight. */
  pieces: number | null;
  /** Minutes pontaged per tracked activity id. */
  minutesByActivity: Record<string, number>;
};

export type ProgressCalibrationResult = {
  fixedWeightKg: number;
  /** False when the default was used for lack of data. */
  fixedWeightFromData: boolean;
  /** Share per activity id, summing to 1. */
  activityWeights: Record<string, number>;
  activityWeightsFromData: boolean;
  /** Delivered projects used, and those left out as outliers. */
  projectCount: number;
  excludedProjectCount: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function sumOf(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

/**
 * Scales the weights to sum to 1 with every share inside the band: a share
 * that falls outside is pinned to the edge, and what is left is split over the
 * others in proportion, until nothing moves.
 */
function boundedShares(raw: Record<string, number>): Record<string, number> {
  const { min, max } = PROGRESS_CALIBRATION_BOUNDS.activityShare;
  const ids = Object.keys(raw);
  // A band the activities cannot fill (too few or too many) is dropped.
  if (ids.length * min > 1 || ids.length * max < 1) {
    const total = sumOf(raw);
    return Object.fromEntries(ids.map((id) => [id, raw[id] / total]));
  }

  const pinned: Record<string, number> = {};
  for (;;) {
    const free = ids.filter((id) => pinned[id] === undefined);
    const room = 1 - sumOf(pinned);
    const freeTotal = free.reduce((total, id) => total + raw[id], 0);
    const shares = Object.fromEntries(free.map((id) => [id, (raw[id] / freeTotal) * room]));
    const outside = free.filter((id) => shares[id] < min || shares[id] > max);
    if (outside.length === 0) {
      return { ...shares, ...pinned };
    }
    for (const id of outside) {
      pinned[id] = clamp(shares[id], min, max);
    }
  }
}

function equalShares(activityIds: string[]): Record<string, number> {
  return Object.fromEntries(activityIds.map((id) => [id, 1 / activityIds.length]));
}

/**
 * Least squares through the origin: hours ≈ a × kg + b × pieces. The ratio
 * b / a is what one piece costs, in kilograms of ordinary work.
 */
function fitFixedWeightKg(samples: { kg: number; pieces: number; hours: number }[]): number | null {
  let kk = 0;
  let kp = 0;
  let pp = 0;
  let kh = 0;
  let ph = 0;
  for (const { kg, pieces, hours } of samples) {
    kk += kg * kg;
    kp += kg * pieces;
    pp += pieces * pieces;
    kh += kg * hours;
    ph += pieces * hours;
  }
  const determinant = kk * pp - kp * kp;
  if (Math.abs(determinant) < 1e-9) {
    return null;
  }
  const a = (kh * pp - ph * kp) / determinant;
  const b = (ph * kk - kh * kp) / determinant;
  if (a <= 0 || b < 0) {
    return null;
  }
  return b / a;
}

export function computeProgressCalibration(
  samples: ProgressCalibrationSample[],
  trackedActivityIds: string[],
): ProgressCalibrationResult {
  const bounds = PROGRESS_CALIBRATION_BOUNDS;
  const tracked = new Set(trackedActivityIds);

  const usable = samples.flatMap((sample) => {
    if (!sample.weightKg || sample.weightKg <= 0) {
      return [];
    }
    const minutes = Object.entries(sample.minutesByActivity)
      .filter(([id]) => tracked.has(id))
      .reduce((total, [, value]) => total + value, 0);
    const hoursPerTon = minutes / 60 / (sample.weightKg / 1000);
    if (hoursPerTon < bounds.projectHoursPerTon.min || hoursPerTon > bounds.projectHoursPerTon.max) {
      return [];
    }
    return [{ ...sample, weightKg: sample.weightKg, hours: minutes / 60 }];
  });
  const excludedProjectCount = samples.filter((sample) => (sample.weightKg ?? 0) > 0).length - usable.length;

  // Activity shares: the median hours per ton of each activity, over the
  // projects where it was done at all — a project that was never painted says
  // nothing about what painting costs.
  let activityWeights = equalShares(trackedActivityIds);
  let activityWeightsFromData = false;
  if (usable.length >= bounds.minProjectsForActivityWeights && trackedActivityIds.length > 0) {
    const medians: Record<string, number> = {};
    for (const id of trackedActivityIds) {
      const rates = usable
        .map((sample) => (sample.minutesByActivity[id] ?? 0) / 60 / (sample.weightKg / 1000))
        .filter((rate) => rate > 0);
      if (rates.length > 0) {
        medians[id] = median(rates);
      }
    }
    const known = Object.values(medians);
    if (known.length > 0) {
      const fallback = known.reduce((total, value) => total + value, 0) / known.length;
      activityWeights = boundedShares(
        Object.fromEntries(trackedActivityIds.map((id) => [id, medians[id] ?? fallback])),
      );
      activityWeightsFromData = true;
    }
  }

  let fixedWeightKg: number = bounds.fixedWeightKg.fallback;
  let fixedWeightFromData = false;
  const withList = usable.flatMap((sample) =>
    sample.pieces && sample.pieces > 0
      ? [{ kg: sample.weightKg, pieces: sample.pieces, hours: sample.hours }]
      : [],
  );
  if (withList.length >= bounds.minProjectsForFixedWeight) {
    const fitted = fitFixedWeightKg(withList);
    if (fitted !== null) {
      fixedWeightKg = clamp(fitted, bounds.fixedWeightKg.min, bounds.fixedWeightKg.max);
      fixedWeightFromData = true;
    }
  }

  return {
    fixedWeightKg,
    fixedWeightFromData,
    activityWeights,
    activityWeightsFromData,
    projectCount: usable.length,
    excludedProjectCount,
  };
}

/**
 * Shares for the activities tracked now. One added since the last calibration
 * gets the average share of the others; the lot is scaled back to sum to 1.
 */
export function sharesForActivities(
  stored: Record<string, number>,
  activityIds: string[],
): Record<string, number> {
  const known = activityIds.filter((id) => stored[id] !== undefined);
  if (known.length === 0) {
    return equalShares(activityIds);
  }
  const average = known.reduce((total, id) => total + stored[id], 0) / known.length;
  const raw = Object.fromEntries(activityIds.map((id) => [id, stored[id] ?? average]));
  const total = sumOf(raw);
  return Object.fromEntries(Object.entries(raw).map(([id, value]) => [id, value / total]));
}
