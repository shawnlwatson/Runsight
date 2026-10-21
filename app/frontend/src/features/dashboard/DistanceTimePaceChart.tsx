"use client";

import type { ComponentProps } from "react";
import DistanceTimePace from "@/components/charts/distanceTimePace";
import { useDateRange } from "@/components/DateRangeProvider";

type Props = {
  runs?: ComponentProps<typeof DistanceTimePace>["runs"];
};

export default function DistanceTimePaceChart({ runs = [] }: Props) {
  const { fromDate, toDate } = useDateRange();

  return (
    <div className="flex h-full flex-col">
      <h2 className="shrink-0 px-4 pt-3 text-base font-semibold text-foreground">
        Distance and Pace Over Time
      </h2>
      <div className="min-h-0 flex-1">
        <DistanceTimePace runs={runs} fromDate={fromDate} toDate={toDate} />
      </div>
    </div>
  );
}
