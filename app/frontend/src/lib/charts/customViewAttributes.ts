import { radarMetrics, radarValue } from "./radarMetrics";
import type { CurrentRun } from "@/types/run";

export const customViewAttributes = radarMetrics.map((metric, index) => ({ metric, index }))
  .filter(({ metric }) => metric.key !== "speed");

export function rankAttributeRuns(runs: readonly CurrentRun[], metric: typeof radarMetrics[number]) {
  const ranked = runs.map((run) => ({ run, value: radarValue(run, metric) }))
    .filter((entry): entry is { run: CurrentRun; value: number } => entry.value !== null);
  // Resolve ties consistently with the newest run first, then its stable ID.
  const tie = (a: typeof ranked[number], b: typeof ranked[number]) =>
    b.run.date.localeCompare(a.run.date) || a.run.id.localeCompare(b.run.id);
  return {
    highest: [...ranked].sort((a, b) => b.value - a.value || tie(a, b)).slice(0, 3),
    lowest: [...ranked].sort((a, b) => a.value - b.value || tie(a, b)).slice(0, 3),
  };
}
