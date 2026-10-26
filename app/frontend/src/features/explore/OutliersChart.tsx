"use client";

import Outliers from "@/components/charts/outliers";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";
import type { CurrentRun } from "@/types/run";

export default function OutliersChart({ runs }: { runs: readonly CurrentRun[] }) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);
  return <Outliers runs={analysisRuns} fromDate={fromDate} toDate={toDate} />;
}
