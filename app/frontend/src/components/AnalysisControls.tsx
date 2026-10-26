"use client";

import { useAnalysis } from "@/components/AnalysisProvider";
import { formatNumber, formatPace } from "@/lib/runFormatters";

export default function AnalysisControls() {
  const { excludedRuns, restoreRun, restoreAll } = useAnalysis();
  if (!excludedRuns.length) return null;

  return <section aria-label="Analysis exclusions" className="mt-6 rounded-lg border border-control-border bg-surface px-4 py-3 text-sm text-foreground">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p role="status" className="font-semibold">{excludedRuns.length} {excludedRuns.length === 1 ? "run excluded" : "runs excluded"} from analysis</p>
      <button type="button" onClick={restoreAll} className="cursor-pointer rounded border border-control-border px-3 py-1 font-medium hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand">Restore all</button>
    </div>
    <p className="mt-1 text-xs text-muted">Applies to all charts, summaries, and both comparison periods. Saved in this browser; original records are preserved.</p>
    <details className="mt-3">
      <summary className="cursor-pointer font-medium text-brand">Review excluded runs</summary>
      <ul className="mt-2 max-h-64 space-y-2 overflow-y-auto">
        {excludedRuns.map((run) => <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 rounded bg-surface-muted px-3 py-2">
          <span><time dateTime={run.date}>{run.date.slice(2)}</time> · {formatNumber(run.distanceMiles, 2)} mi · {formatPace(run.pace)} min/mi <span className="text-xs text-muted">({run.id})</span></span>
          <button type="button" onClick={() => restoreRun(run.id)} aria-label={`Restore run ${run.id} to analysis`} className="cursor-pointer rounded px-2 py-1 font-semibold text-brand hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand">Restore</button>
        </li>)}
      </ul>
    </details>
  </section>;
}
