"use client";

import Fatigue from "@/components/charts/fatigue";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";
import type { FatigueRun } from "@/types/fatigue";

export default function FatigueChart({ runs }: { runs: readonly FatigueRun[] }) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);
  return <Fatigue runs={analysisRuns} fromDate={fromDate} toDate={toDate} />;
}
