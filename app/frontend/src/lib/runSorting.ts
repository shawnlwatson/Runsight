import type { CurrentRun } from "@/types/run";

export type RunSortKey = "date" | "totalTimeSeconds" | "distanceMiles" | "pace" | "speed" | "heartRate" | "temperature" | "elevationFeet";
export type RunSort = { key: RunSortKey; direction: "ascending" | "descending" };

export const runSortColumns: { key: RunSortKey; label: string; title: string }[] = [
  { key: "date", label: "Date", title: "Workout date" },
  { key: "totalTimeSeconds", label: "Total Time", title: "Hours:minutes:seconds" },
  { key: "distanceMiles", label: "Distance (mi)", title: "Miles" },
  { key: "pace", label: "Pace (min/mi)", title: "Minutes per mile" },
  { key: "speed", label: "Speed (MPH)", title: "Miles per hour" },
  { key: "heartRate", label: "Heart rate (bpm)", title: "Average heart rate in beats per minute" },
  { key: "temperature", label: "Temperature (°F)", title: "Temperature in degrees Fahrenheit" },
  { key: "elevationFeet", label: "Elevation (ft)", title: "Feet" },
];

function sortValue(run: CurrentRun, key: RunSortKey): number | string | null {
  if (key === "date") return run.date || null;
  const value = key === "speed" ? (run.pace !== null && Number.isFinite(run.pace) && run.pace > 0 ? 60 / run.pace : null) : run[key];
  if (value === null || !Number.isFinite(value)) return null;
  if (key === "pace" && value <= 0) return null;
  if (key === "totalTimeSeconds" && value < 0) return null;
  return value;
}

export function sortRuns(runs: readonly CurrentRun[], { key, direction }: RunSort): CurrentRun[] {
  const sign = direction === "ascending" ? 1 : -1;
  return [...runs].sort((a, b) => {
    const left = sortValue(a, key);
    const right = sortValue(b, key);
    // Unavailable values always stay at the bottom, even in descending order.
    if (left === null && right !== null) return 1;
    if (right === null && left !== null) return -1;
    const comparison = left === null || right === null ? 0
      : typeof left === "number" && typeof right === "number" ? left - right
        : String(left).localeCompare(String(right));
    return comparison * sign || b.date.localeCompare(a.date) || a.id.localeCompare(b.id);
  });
}
