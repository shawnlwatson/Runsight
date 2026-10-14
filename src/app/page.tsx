import FilterBar from "@/components/FilterBar";
import PeriodComparison from "@/components/PeriodComparison";
import Image from "next/image";
import runnerIcon from "../../public/images/runner_icon.png";
import distanceIcon from "../../public/images/distance_icon.png";
import stopwatchIcon from "../../public/images/stopwatch_icon.png";
import heartRateIcon from "../../public/images/hr_icon.png";

const summaryMetrics = [
  {
    label: "Total Runs",
    unit: "runs",
    image: runnerIcon,
  },
  {
    label: "Total Distance",
    unit: "miles",
    image: distanceIcon,
  },
  {
    label: "Avg Pace",
    unit: "min/mi",
    image: stopwatchIcon,
  },
  {
    label: "Avg Heart Rate",
    unit: "bpm",
    image: heartRateIcon,
  },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-muted md:text-base">
          A summary of your running data and key insights.
        </p>
      </header>
      <dl
        aria-label="Running summary"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryMetrics.map((metric) => (
          <div
            key={metric.label}
            className="relative flex min-h-32 flex-col justify-center rounded-lg border border-border bg-surface p-5 pl-24 text-left"
          >
            <dt className="text-sm font-medium text-muted">
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
                <span aria-hidden="true">—</span>
                <span className="sr-only">Data not connected</span>
              </span>
              <span className="text-sm text-muted">{metric.unit}</span>
              </div>
              {/* Supply the selected and previous period metrics when workout data is connected. */}
              <PeriodComparison currentValue={null} previousValue={null} />
            </dd>
          </div>
        ))}
      </dl>
      <FilterBar />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          aria-label="First graph placeholder"
          className="min-h-80 rounded-lg border border-border bg-surface"
        />
        <section
          aria-label="Second graph placeholder"
          className="min-h-80 rounded-lg border border-border bg-surface"
        />
      </div>
      <section
        aria-label="Full-width chart or list placeholder"
        className="min-h-96 rounded-lg border border-border bg-surface"
      />
    </div>
  );
}
