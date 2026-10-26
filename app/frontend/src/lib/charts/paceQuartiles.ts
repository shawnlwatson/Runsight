import { quantileSorted } from "d3-array";

export function paceQuartiles(values: readonly number[]) {
  const sorted = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  return {
    count: sorted.length,
    q1: quantileSorted(sorted, 0.25) ?? null,
    median: quantileSorted(sorted, 0.5) ?? null,
    q3: quantileSorted(sorted, 0.75) ?? null,
  };
}

export function isPaceIqrOutlier(pace: number, statistics: ReturnType<typeof paceQuartiles>) {
  if (!Number.isFinite(pace) || pace <= 0 || statistics.count < 4 || statistics.q1 === null || statistics.q3 === null) return false;
  const iqr = statistics.q3 - statistics.q1;
  return pace < statistics.q1 - 1.5 * iqr || pace > statistics.q3 + 1.5 * iqr;
}
