import { quantileSorted } from "d3-array";

const groups = [
  { id: "under-3", label: "Under 3 miles", min: 0, max: 3, center: 1.5 },
  { id: "3-4", label: "3–4 miles", min: 3, max: 4, center: 3.5 },
  { id: "4-5", label: "4–5 miles", min: 4, max: 5, center: 4.5 },
  { id: "5-6", label: "5–6 miles", min: 5, max: 6, center: 5.5 },
  { id: "6-7", label: "6–7 miles", min: 6, max: 7, center: 6.5 },
  { id: "7-9", label: "7–9 miles", min: 7, max: 9, center: 8 },
  { id: "9-plus", label: "9+ miles", min: 9, max: Infinity, center: 9.5 },
];

/** Tukey boxes: quartiles with whiskers at observed values within 1.5 × IQR. */
export function distancePaceBoxplots(runs: readonly { distanceMiles: number; pace: number }[]) {
  return groups.flatMap((group) => {
    const members = runs.filter(({ distanceMiles, pace }) =>
      Number.isFinite(distanceMiles) && Number.isFinite(pace) && pace > 0 &&
      distanceMiles >= group.min && distanceMiles < group.max,
    );
    if (!members.length) return [];
    const values = members.map((run) => run.pace).sort((a, b) => a - b);
    const q1 = quantileSorted(values, 0.25)!;
    const median = quantileSorted(values, 0.5)!;
    const q3 = quantileSorted(values, 0.75)!;
    const iqr = q3 - q1;
    const inliers = values.filter((value) => value >= q1 - 1.5 * iqr && value <= q3 + 1.5 * iqr);
    // Keep the open-ended group's box centered over its actual distance span.
    const center = group.id === "9-plus" ? (9 + Math.max(...members.map((run) => run.distanceMiles))) / 2 : group.center;
    return [{ id: group.id, label: group.label, center, count: values.length,
      q1, median, q3, lower: inliers[0], upper: inliers.at(-1)!,
      min: values[0], max: values.at(-1)!, outliers: values.length - inliers.length }];
  });
}
