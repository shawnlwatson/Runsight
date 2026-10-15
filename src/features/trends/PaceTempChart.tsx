"use client";

import { useState } from "react";
import type { CurrentRun } from "@/types/run";
import RunDetailsDialog from "@/components/RunDetailsDialog";
import PaceTemp from "@/components/charts/paceTemp";
import { useDateRange } from "@/components/DateRangeProvider";

type Props = {
  runs: CurrentRun[];
};

export default function PaceTempChart({ runs }: Props) {
  const { fromDate, toDate } = useDateRange();
  const [selectedRun, setSelectedRun] = useState<CurrentRun | null>(null);

  return (
    <div className="flex h-full flex-col">
      <h2 className="shrink-0 px-4 pt-3 text-base font-semibold text-foreground">
        Pace vs. Temperature
      </h2>
      <div className="min-h-0 flex-1">
        <PaceTemp runs={runs} fromDate={fromDate} toDate={toDate} onSelectRun={setSelectedRun} />
      </div>
      <p className="shrink-0 px-4 pb-3 text-xs leading-5 text-muted">
        Mean pace across plotted runs · Band: ±1 SD · Bold points: beyond ±2 SD
      </p>
      <RunDetailsDialog selectedRun={selectedRun} onClose={() => setSelectedRun(null)} />
    </div>
  );
}
