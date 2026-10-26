"use client";

import TemperatureHeartRatePace, { type TemperatureHeartRatePaceRun } from "@/components/charts/temperatureHeartRatePace";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";

type Props = { runs?: TemperatureHeartRatePaceRun[] };

export default function TemperatureHeartRatePaceChart({ runs = [] }: Props) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);
  // Workout dates are calendar dates in YYYY-MM-DD format, so string ordering applies.
  const selectedRuns = analysisRuns.filter((run) =>
    (!fromDate || run.date >= fromDate) && (!toDate || run.date <= toDate),
  );

  return (
    <TemperatureHeartRatePace
      runs={selectedRuns}
      title="Temperature, Heart Rate and Pace"
    />
  );
}
