import type { FatigueRun } from "@/types/fatigue";
import type { CurrentRun } from "@/types/run";
import type { DashboardSummary } from "@/types/summary";

// FastAPI backend (app/backend). NEXT_PUBLIC_ makes it usable in the browser too.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function getJson<T>(path: string): Promise<T> {
  // no-store: fetch fresh data on every request instead of once at build time
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`GET ${path} failed with status ${response.status}`);
  return response.json();
}

export const fetchRuns = () => getJson<CurrentRun[]>("/runs");
export const fetchFatigueRuns = () => getJson<FatigueRun[]>("/insights/fatigue");

// Dates are YYYY-MM-DD; an empty string means no limit on that side.
export function fetchSummary(start: string, end: string, excludedRunIds: readonly string[] = []) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  for (const id of excludedRunIds) params.append("exclude_id", id);
  return getJson<DashboardSummary>(`/runs/summary?${params}`);
}
