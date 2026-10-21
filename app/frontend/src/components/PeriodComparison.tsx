"use client";

import { useDateRange } from "@/components/DateRangeProvider";
import { getPercentageChange } from "@/lib/periodComparison";

type PeriodComparisonProps = {
  currentValue: number | null;
  previousValue: number | null;
};

export default function PeriodComparison({ currentValue, previousValue }: PeriodComparisonProps) {
  const { previousPeriod } = useDateRange();
  const change = getPercentageChange(currentValue, previousValue);
  if (!previousPeriod || change === null) return null;

  const color = change > 0 ? "text-positive" : change < 0 ? "text-negative" : "text-muted";
  const percentage = Math.abs(change).toLocaleString("en-US", { maximumFractionDigits: 1 });

  return (
    <span className="mt-2 block text-xs">
      <span className={`inline-flex items-center gap-1 font-medium ${color}`}>
        {change !== 0 && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-3.5 w-3.5 shrink-0"
          >
            <path d={change > 0 ? "M12 19V5 m-6 6 6-6 6 6" : "M12 5v14 m-6-6 6 6 6-6"} />
          </svg>
        )}
        <span className="sr-only">{change > 0 ? "Increase of " : change < 0 ? "Decrease of " : ""}</span>
        {percentage}%
      </span>{" "}
      <span className="text-muted">vs. previous period</span>
    </span>
  );
}
