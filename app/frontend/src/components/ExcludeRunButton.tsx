"use client";

import { useAnalysis } from "@/components/AnalysisProvider";
import type { CurrentRun } from "@/types/run";

export default function ExcludeRunButton({ run, compact = false }: { run: CurrentRun; compact?: boolean }) {
  const { excludeRun, excludedRunIds } = useAnalysis();
  return <button type="button" disabled={excludedRunIds.includes(run.id)}
    onClick={(event) => { event.stopPropagation(); excludeRun(run); }}
    aria-label={`Exclude run on ${run.date} from analysis`} title="Exclude from analysis (does not delete this run)"
    className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded text-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-default disabled:opacity-40 ${compact ? "h-8 w-8" : "border border-control-border bg-surface px-3 py-2 text-xs font-semibold"}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} aria-hidden="true" className="h-4 w-4 shrink-0"><circle cx={12} cy={12} r={9} /><path d="M8 12h8" /></svg>
    {!compact && "Exclude from analysis"}
  </button>;
}
