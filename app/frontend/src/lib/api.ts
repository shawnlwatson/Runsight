import type { ChatEvent, ChatRequest } from "@/types/chat";
import type { FatigueRun } from "@/types/fatigue";
import type { CurrentRun } from "@/types/run";
import type { DashboardSummary } from "@/types/summary";
import type { AttributeSelections } from "@/lib/dashboardFilterRanges";

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
export function fetchSummary(start: string, end: string, excludedRunIds: readonly string[] = [], minPace: number | null = null, maxPace: number | null = null, attributes?: AttributeSelections, minDistance: number | null = null, maxDistance: number | null = null) {
  const params = new URLSearchParams();
  if (start) params.set("start", start);
  if (end) params.set("end", end);
  for (const id of excludedRunIds) params.append("exclude_id", id);
  if (minPace !== null) params.set("min_pace", String(minPace));
  if (maxPace !== null) params.set("max_pace", String(maxPace));
  if (minDistance !== null) params.set("min_distance", String(minDistance));
  if (maxDistance !== null) params.set("max_distance", String(maxDistance));
  for (const [name, value] of Object.entries(attributes ?? {})) if (value) params.set(name, value);
  return getJson<DashboardSummary>(`/runs/summary?${params}`);
}

// Streams the Runsight Assistant's reply, calling onEvent for each NDJSON line. Abort with signal to stop.
export async function streamChat(request: ChatRequest, onEvent: (event: ChatEvent) => void, signal?: AbortSignal) {
  const response = await fetch(`${API_URL}/insights/chat`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request), signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(response.status === 503 ? "The assistant is not set up on this server yet."
      : response.status === 422 ? "The assistant could not read that request. Check the filters and try again."
      : `The assistant is unavailable right now (status ${response.status}).`);
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (value) buffer += value;
    // Each complete line is one event; keep a partial line until the rest arrives
    const lines = buffer.split("\n");
    buffer = done ? "" : lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line) as ChatEvent);
    if (done) return;
  }
}
