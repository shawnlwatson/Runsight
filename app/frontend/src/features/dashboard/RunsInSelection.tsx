"use client";

import CurrentRunsList, { type CurrentRun } from "@/components/charts/CurrentRunsList";
import { useDateRange } from "@/components/DateRangeProvider";

type Props = { runs?: readonly CurrentRun[] };

export default function RunsInSelection({ runs = [] }: Props) {
  const { fromDate, toDate } = useDateRange();
  const selectedRuns = runs.filter((run) =>
    (!fromDate || run.date >= fromDate) && (!toDate || run.date <= toDate),
  );

  return <CurrentRunsList runs={selectedRuns} />;
}
