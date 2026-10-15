"use client";

import VolumePace from "@/components/charts/volumePace";
import { useDateRange } from "@/components/DateRangeProvider";
import type { VolumeRun } from "@/lib/charts/weeklyVolume";

export default function VolumePaceChart({ runs }: { runs: readonly VolumeRun[] }) {
  const { fromDate, toDate } = useDateRange();
  return <div className="flex h-full flex-col">
    <h2 className="shrink-0 px-4 pt-3 text-base font-semibold text-foreground">Weekly Volume and Pace</h2>
    <div className="min-h-0 flex-1"><VolumePace runs={runs} fromDate={fromDate} toDate={toDate} /></div>
    <p className="shrink-0 px-4 pb-3 text-xs leading-5 text-muted">Monday–Sunday weeks · Pace: total time ÷ distance · Boundary weeks use selected dates only</p>
  </div>;
}
