"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useDateRange } from "@/components/DateRangeProvider";
import PeriodComparison from "@/components/PeriodComparison";
import { fetchSummary } from "@/lib/api";
import { formatNumber, formatPace } from "@/lib/runFormatters";
import type { DashboardSummary, RunSummary } from "@/types/summary";
import runnerIcon from "../../../public/images/runner_icon.png";
import distanceIcon from "../../../public/images/distance_icon.png";
import stopwatchIcon from "../../../public/images/stopwatch_icon.png";
import heartRateIcon from "../../../public/images/hr_icon.png";

const summaryMetrics = [
  {
    label: "Total Runs",
    unit: "runs",
    image: runnerIcon,
    colors: "border-teal/25 border-t-teal bg-teal/10",
    value: (summary: RunSummary) => summary.totalRuns,
    format: (value: number | null) => formatNumber(value),
  },
  {
    label: "Total Distance",
    unit: "miles",
    image: distanceIcon,
    colors: "border-gold/40 border-t-gold bg-gold/15",
    value: (summary: RunSummary) => summary.totalDistanceMiles,
    format: (value: number | null) => formatNumber(value, 1),
  },
  {
    label: "Avg Pace",
    unit: "min/mi",
    image: stopwatchIcon,
    colors: "border-berry/25 border-t-berry bg-berry/10",
    value: (summary: RunSummary) => summary.avgPace,
    format: formatPace,
  },
  {
    label: "Avg Heart Rate",
    unit: "bpm",
    image: heartRateIcon,
    colors: "border-orange/30 border-t-orange bg-orange/10",
    value: (summary: RunSummary) => summary.avgHeartRate,
    format: (value: number | null) => formatNumber(value),
  },
];

export default function SummaryTiles() {
  const { fromDate, toDate } = useDateRange();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  // Refetch whenever the selected date range changes
  useEffect(() => {
    let ignore = false; // drop a slow response if the range changed again
    fetchSummary(fromDate, toDate)
      .then((result) => { if (!ignore) setSummary(result); })
      .catch(() => { if (!ignore) setSummary(null); });
    return () => { ignore = true; };
  }, [fromDate, toDate]);

  return (
    <dl
      aria-label="Running summary"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {summaryMetrics.map((metric) => {
        const current = summary ? metric.value(summary.current) : null;
        const previous = summary?.previous ? metric.value(summary.previous) : null;

        return (
          <div
            key={metric.label}
            className={`relative flex min-h-32 flex-col justify-center rounded-lg border border-t-4 p-5 pl-24 text-left ${metric.colors}`}
          >
            <dt className="text-sm font-semibold text-foreground">
              <Image
                src={metric.image}
                alt=""
                sizes="64px"
                className="absolute left-5 top-1/2 h-16 w-16 -translate-y-1/2 object-contain"
              />
              {metric.label}
            </dt>
            <dd className="mt-3">
              <div className="flex flex-wrap items-baseline justify-start gap-2">
                <span className="text-3xl font-bold tabular-nums text-foreground">
                  {metric.format(current)}
                </span>
                <span className="text-sm text-muted">{metric.unit}</span>
              </div>
              <PeriodComparison currentValue={current} previousValue={previous} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
