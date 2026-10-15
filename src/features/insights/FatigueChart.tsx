"use client";

import Fatigue from "@/components/charts/fatigue";
import { useDateRange } from "@/components/DateRangeProvider";
import type { FatigueRun } from "@/types/fatigue";

export default function FatigueChart({ runs }: { runs: readonly FatigueRun[] }) {
  const { fromDate, toDate } = useDateRange();
  return <Fatigue runs={runs} fromDate={fromDate} toDate={toDate} />;
}
