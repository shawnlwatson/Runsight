import type { CurrentRun } from "@/types/run";

type RadarMetric = {
  key: string;
  label: string;
  unit: string;
  fallbackMax: number;
  format?: "time" | "pace";
  value: (run: CurrentRun) => number | null | undefined;
};

// D3 radial angles start at 12 o'clock and increase clockwise.
export const radarMetrics: RadarMetric[] = [
  { key: "time", label: "Total Time", unit: "h:mm:ss", fallbackMax: 3600, format: "time", value: (r) => r.totalTimeSeconds },
  { key: "distance", label: "Distance", unit: "mi", fallbackMax: 10, value: (r) => r.distanceMiles },
  { key: "pace", label: "Pace", unit: "min/mi", fallbackMax: 12, format: "pace", value: (r) => r.pace },
  { key: "speed", label: "Speed", unit: "mph", fallbackMax: 10, value: (r) => r.pace !== null && r.pace > 0 ? 60 / r.pace : null },
  { key: "cadence", label: "Cadence", unit: "steps/min", fallbackMax: 200, value: (r) => r.averageCadenceSpm },
  { key: "calories", label: "Calories", unit: "kcal", fallbackMax: 1000, value: (r) => r.totalCalories },
  { key: "heartRate", label: "Heart Rate", unit: "bpm", fallbackMax: 200, value: (r) => r.heartRate },
  { key: "sleep", label: "Sleep Hours", unit: "h", fallbackMax: 10, value: (r) => r.sleepHours },
  { key: "temperature", label: "Temperature", unit: "°F", fallbackMax: 100, value: (r) => r.temperature },
  { key: "elevation", label: "Elevation", unit: "ft", fallbackMax: 1000, value: (r) => r.elevationFeet },
];

export function radarAngle(index: number) {
  return index * 2 * Math.PI / radarMetrics.length;
}

export function radarValue(run: CurrentRun, metric: RadarMetric) {
  const value = metric.value(run);
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  if (metric.key !== "temperature" && value < 0) return null;
  if ((metric.key === "pace" || metric.key === "speed") && value <= 0) return null;
  return value;
}

export function radarDomain(runs: readonly CurrentRun[], metric: RadarMetric): [number, number] {
  const values = runs.map((run) => radarValue(run, metric)).filter((value) => value !== null);
  if (!values.length) return [0, metric.fallbackMax];
  const low = Math.min(0, values.reduce((a, b) => Math.min(a, b)));
  const high = Math.max(0, values.reduce((a, b) => Math.max(a, b)));
  if (low === high) return [0, metric.fallbackMax];
  return [low < 0 ? low * 1.1 : 0, high > 0 ? high * 1.1 : 0];
}
