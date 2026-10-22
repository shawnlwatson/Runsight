// Response of GET /runs/summary; null means no data for that value.
export type RunSummary = {
  totalRuns: number;
  totalDistanceMiles: number;
  avgPace: number | null; // Total time / total distance, decimal min/mile.
  avgHeartRate: number | null; // Average bpm.
};

export type DashboardSummary = {
  current: RunSummary;
  previous: RunSummary | null; // Null unless both start and end dates are selected.
};
