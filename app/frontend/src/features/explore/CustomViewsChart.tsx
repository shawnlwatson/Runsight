"use client";

import CustomViews from "@/components/charts/customViews";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";
import type { CurrentRun } from "@/types/run";

export default function CustomViewsChart({ runs }: { runs: readonly CurrentRun[] }) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);
  return <CustomViews runs={analysisRuns} fromDate={fromDate} toDate={toDate} />;
}
