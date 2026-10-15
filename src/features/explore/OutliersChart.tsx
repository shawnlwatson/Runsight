"use client";

import Outliers from "@/components/charts/outliers";
import { useDateRange } from "@/components/DateRangeProvider";
import type { CurrentRun } from "@/types/run";

export default function OutliersChart({ runs }: { runs: readonly CurrentRun[] }) {
  const { fromDate, toDate } = useDateRange();
  return <Outliers runs={runs} fromDate={fromDate} toDate={toDate} />;
}
