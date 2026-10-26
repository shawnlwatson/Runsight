"use client";

import TemperatureHeartRateByPace from "@/components/charts/temperatureHeartRateByPace";
import type { TemperatureHeartRatePaceRun } from "@/components/charts/temperatureHeartRatePace";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";

export default function TemperatureHeartRateByPaceChart({ runs }: { runs: TemperatureHeartRatePaceRun[] }) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);
  const selectedRuns = analysisRuns.filter((run) =>
    (!fromDate || run.date >= fromDate) && (!toDate || run.date <= toDate),
  );
  return <TemperatureHeartRateByPace runs={selectedRuns} />;
}
