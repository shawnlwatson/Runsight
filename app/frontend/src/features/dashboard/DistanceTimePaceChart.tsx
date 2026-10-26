"use client";

import type { ComponentProps } from "react";
import DistanceTimePace from "@/components/charts/distanceTimePace";
import { useAnalysisRuns } from "@/components/AnalysisProvider";
import { useDateRange } from "@/components/DateRangeProvider";

type Props = {
  runs?: ComponentProps<typeof DistanceTimePace>["runs"];
};

export default function DistanceTimePaceChart({ runs = [] }: Props) {
  const { fromDate, toDate } = useDateRange();
  const analysisRuns = useAnalysisRuns(runs);

  return (
    <div className="flex h-full flex-col">
      <h2 className="shrink-0 px-4 pt-3 text-base font-semibold text-foreground">
        Distance and Pace by Run Date
      </h2>
      <div className="min-h-0 flex-1">
        <DistanceTimePace runs={analysisRuns} fromDate={fromDate} toDate={toDate} />
      </div>
    </div>
  );
}
