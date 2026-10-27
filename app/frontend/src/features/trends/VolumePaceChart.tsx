"use client";

import VolumePace from "@/components/charts/volumePace";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";
import type { VolumeRun } from "@/lib/charts/weeklyVolume";

export default function VolumePaceChart({ runs }: { runs: readonly VolumeRun[] }) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);
  return <div className="flex h-full flex-col">
    <h2 className="shrink-0 px-4 pt-3 text-base font-semibold text-foreground">Prior 30-Day Volume and Pace</h2>
    <div className="min-h-0 flex-1"><VolumePace runs={analysisRuns} fromDate={fromDate} toDate={toDate} /></div>
    <p className="shrink-0 px-4 pb-3 text-xs leading-5 text-muted">Selected dates · One square per run · Lookbacks include available history before the selection and exclude the run’s calendar date</p>
  </div>;
}
