"use client";

import CustomViews from "@/components/charts/customViews";
import { useDateRange } from "@/components/DateRangeProvider";
import type { CurrentRun } from "@/types/run";

export default function CustomViewsChart({ runs }: { runs: readonly CurrentRun[] }) {
  const { fromDate, toDate } = useDateRange();
  return <CustomViews runs={runs} fromDate={fromDate} toDate={toDate} />;
}
