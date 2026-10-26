import { quantileSorted } from "d3-array";

export const PACE_ROLLING_WINDOW = 10;

/** Trailing valid runs, including the current run; early windows use fewer runs. */
export function rollingPaceStatistics(values: readonly number[], windowSize = PACE_ROLLING_WINDOW) {
  if (!Number.isInteger(windowSize) || windowSize < 1) throw new RangeError("Window size must be a positive integer.");
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  return valid.map((pace, index) => {
    const window = valid.slice(Math.max(0, index - windowSize + 1), index + 1).sort((a, b) => a - b);
    const q1 = quantileSorted(window, 0.25)!;
    const median = quantileSorted(window, 0.5)!;
    const q3 = quantileSorted(window, 0.75)!;
    const iqr = q3 - q1;
    const lowerFence = q1 - 1.5 * iqr;
    const upperFence = q3 + 1.5 * iqr;
    return { count: window.length, q1, median, q3, lowerFence, upperFence,
      outlier: window.length >= 4 && (pace < lowerFence || pace > upperFence) };
  });
}
