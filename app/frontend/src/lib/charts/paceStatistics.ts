import { deviation, mean } from "d3-array";

export function paceStatistics(values: readonly number[]) {
  const valid = values.filter((value) => Number.isFinite(value) && value > 0);
  return {
    mean: mean(valid) ?? null,
    standardDeviation: deviation(valid) ?? null,
    count: valid.length,
  };
}

export function isPaceOutlier(
  pace: number,
  statistics: ReturnType<typeof paceStatistics>,
  threshold = 2,
) {
  return statistics.mean !== null && statistics.standardDeviation !== null &&
    statistics.standardDeviation > 0 &&
    Math.abs(pace - statistics.mean) > threshold * statistics.standardDeviation;
}
