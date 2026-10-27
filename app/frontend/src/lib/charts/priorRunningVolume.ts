import type { VolumeRun } from "./weeklyVolume";

const DAY = 86_400_000;
export const runDistanceBands = [
  { label: "<3 mi", max: 3, color: "var(--color-chart-teal)" },
  { label: "3–4 mi", max: 4, color: "var(--color-chart-gold)" },
  { label: "4–5 mi", max: 5, color: "var(--color-chart-berry)" },
  { label: "5–6 mi", max: 6, color: "var(--color-chart-orange)" },
  { label: "6+ mi", max: Infinity, color: "var(--color-chart-5)" },
];

/** Calendar dates [run date − 30 days, run date), using all supplied history. */
export function priorRunningVolume(runs: readonly VolumeRun[]) {
  const dated = runs.map((run) => ({ ...run, time: Date.parse(`${run.date}T00:00:00Z`) }))
    .filter((run): run is typeof run & { distanceMiles: number } => Number.isFinite(run.time) &&
      new Date(run.time).toISOString().slice(0, 10) === run.date &&
      run.distanceMiles !== null && Number.isFinite(run.distanceMiles) && run.distanceMiles >= 0)
    .sort((a, b) => a.time - b.time || (a.id ?? "").localeCompare(b.id ?? ""));
  const days: { time: number; miles: number; runs: typeof dated }[] = [];
  for (const run of dated) {
    let day = days.at(-1);
    if (!day || day.time !== run.time) {
      day = { time: run.time, miles: 0, runs: [] };
      days.push(day);
    }
    day.miles += run.distanceMiles;
    day.runs.push(run);
  }
  let left = 0;
  let priorMiles = 0;
  return days.flatMap((day, index) => {
    while (left < index && days[left].time < day.time - 30 * DAY) {
      priorMiles -= days[left++].miles;
    }
    const points = day.runs.flatMap((run) => {
      if (run.pace === null || !Number.isFinite(run.pace) || run.pace <= 0) return [];
      return [{ ...run, pace: run.pace, priorMiles: Math.max(0, priorMiles),
        band: runDistanceBands.find((band) => run.distanceMiles < band.max)! }];
    });
    // Same-day runs share a lookback: none of the current day's mileage is prior mileage.
    priorMiles += day.miles;
    return points;
  });
}
