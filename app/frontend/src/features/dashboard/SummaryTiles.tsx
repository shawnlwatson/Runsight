"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useAnalysis } from "@/components/AnalysisProvider";
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
    colors: "border-border bg-surface",
    value: (summary: RunSummary) => summary.totalRuns,
    format: (value: number | null) => formatNumber(value),
  },
  {
    label: "Total Distance",
    unit: "miles",
    image: distanceIcon,
    colors: "border-border bg-surface",
    value: (summary: RunSummary) => summary.totalDistanceMiles,
    format: (value: number | null) => formatNumber(value, 1),
  },
  {
    label: "Avg Pace",
    unit: "min/mi",
    image: stopwatchIcon,
    colors: "border-border bg-surface",
    value: (summary: RunSummary) => summary.avgPace,
    format: formatPace,
  },
  {
    label: "Avg Heart Rate",
    unit: "bpm",
    image: heartRateIcon,
    colors: "border-border bg-surface",
    value: (summary: RunSummary) => summary.avgHeartRate,
    format: (value: number | null) => formatNumber(value),
  },
];

export default function SummaryTiles({ compact = false }: { compact?: boolean }) {
  const { fromDate, toDate } = useDateRange();
  const { excludedRunIds } = useAnalysis();
  const queryKey = JSON.stringify([fromDate, toDate, excludedRunIds]);
  const [loaded, setLoaded] = useState<{ key: string; data: DashboardSummary } | null>(null);
  const summary = loaded?.key === queryKey ? loaded.data : null;

  // Refetch whenever the selected date range changes
  useEffect(() => {
    let ignore = false; // drop a slow response if the range changed again
    fetchSummary(fromDate, toDate, excludedRunIds)
      .then((result) => { if (!ignore) setLoaded({ key: queryKey, data: result }); })
      .catch(() => { if (!ignore) setLoaded(null); });
    return () => { ignore = true; };
  }, [fromDate, toDate, excludedRunIds, queryKey]);

  return (
    <dl
      aria-label="Running summary"
      className={compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"}
    >
      {summaryMetrics.map((metric) => {
        const current = summary ? metric.value(summary.current) : null;
        const previous = summary?.previous ? metric.value(summary.previous) : null;

        return (
          <div
            key={metric.label}
            className={`relative flex min-w-0 flex-col justify-center rounded-lg border border-t-2 text-left ${compact ? "min-h-20 px-3 py-2.5" : "min-h-32 p-5 pl-24"} ${metric.colors}`}
          >
            <dt className={`${compact ? "text-[11px] leading-4" : "text-sm"} font-semibold text-foreground`}>
              {!compact && <Image
                src={metric.image}
                alt=""
                sizes="64px"
                className="absolute left-5 top-1/2 h-16 w-16 -translate-y-1/2 object-contain grayscale opacity-80"
              />}
              {metric.label}
            </dt>
            <dd className={compact ? "mt-1" : "mt-3"}>
              <div className={`flex flex-wrap items-baseline justify-start ${compact ? "gap-x-1 gap-y-0" : "gap-2"}`}>
                <span className={`${compact ? "text-xl leading-7" : "text-3xl"} font-bold tabular-nums text-foreground`}>
                  {metric.format(current)}
                </span>
                <span className={`${compact ? "text-[10px]" : "text-sm"} text-muted`}>{metric.unit}</span>
              </div>
              <PeriodComparison currentValue={current} previousValue={previous} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
