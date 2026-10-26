"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { CurrentRun } from "@/types/run";

type ExcludedRun = Pick<CurrentRun, "id" | "date" | "distanceMiles" | "pace">;
type Analysis = {
  excludedRuns: readonly ExcludedRun[];
  excludedRunIds: readonly string[];
  excludeRun: (run: ExcludedRun) => void;
  restoreRun: (id: string) => void;
  restoreAll: () => void;
};

const STORAGE_KEY = "runsight.analysis.excluded-runs.v1";
const CHANGE_EVENT = "runsight-analysis-change";
const EMPTY: readonly ExcludedRun[] = [];
let snapshot: readonly ExcludedRun[] = EMPTY;
let lastStored: string | null = null;
const AnalysisContext = createContext<Analysis | null>(null);

function readSnapshot() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== lastStored) {
      const parsed: unknown = stored ? JSON.parse(stored) : [];
      const seen = new Set<string>();
      snapshot = Array.isArray(parsed) ? parsed.filter((run): run is ExcludedRun => {
        if (!run || typeof run.id !== "string" || typeof run.date !== "string" || seen.has(run.id)) return false;
        if (![run.distanceMiles, run.pace].every((value) => value === null || (typeof value === "number" && Number.isFinite(value)))) return false;
        seen.add(run.id);
        return true;
      }) : EMPTY;
      lastStored = stored;
    }
  } catch {
    // Private browsing or blocked storage still allows exclusions for this tab.
  }
  return snapshot;
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function save(next: readonly ExcludedRun[]) {
  snapshot = next;
  try {
    const stored = JSON.stringify(next);
    window.localStorage.setItem(STORAGE_KEY, stored);
    lastStored = stored;
  } catch {
    // Keep the in-memory snapshot if saving is unavailable.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export default function AnalysisProvider({ children }: { children: ReactNode }) {
  const excludedRuns = useSyncExternalStore(subscribe, readSnapshot, () => EMPTY);
  const excludedRunIds = useMemo(() => excludedRuns.map((run) => run.id), [excludedRuns]);
  const excludeRun = useCallback((run: ExcludedRun) => {
    const current = readSnapshot();
    if (!current.some((entry) => entry.id === run.id)) {
      save([...current, { id: run.id, date: run.date, distanceMiles: run.distanceMiles, pace: run.pace }]);
    }
  }, []);
  const restoreRun = useCallback((id: string) => save(readSnapshot().filter((run) => run.id !== id)), []);
  const restoreAll = useCallback(() => save([]), []);

  return <AnalysisContext.Provider value={{ excludedRuns, excludedRunIds, excludeRun, restoreRun, restoreAll }}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const analysis = useContext(AnalysisContext);
  if (!analysis) throw new Error("useAnalysis requires AnalysisProvider");
  return analysis;
}

export function useAnalysisRuns<T extends { id?: string }>(runs: readonly T[]) {
  const { excludedRunIds } = useAnalysis();
  return useMemo(() => {
    const excluded = new Set(excludedRunIds);
    return runs.filter((run) => !run.id || !excluded.has(run.id));
  }, [runs, excludedRunIds]);
}
