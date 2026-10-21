"use client";

import TemperatureHeartRatePace, { type TemperatureHeartRatePaceRun } from "@/components/charts/temperatureHeartRatePace";
import { useDateRange } from "@/components/DateRangeProvider";

type Props = { runs?: TemperatureHeartRatePaceRun[] };

export default function TemperatureHeartRatePaceChart({ runs = [] }: Props) {
  const { fromDate, toDate } = useDateRange();
  // Workout dates are calendar dates in YYYY-MM-DD format, so string ordering applies.
  const selectedRuns = runs.filter((run) =>
    (!fromDate || run.date >= fromDate) && (!toDate || run.date <= toDate),
  );

  return (
    <TemperatureHeartRatePace
      runs={selectedRuns}
      title="Temperature, Heart Rate and Pace"
    />
  );
}
