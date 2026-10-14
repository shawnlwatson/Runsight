import FilterBar from "@/components/FilterBar";
import DistanceTimePaceChart from "@/features/dashboard/DistanceTimePaceChart";
import TemperatureHeartRatePaceChart from "@/features/dashboard/TemperatureHeartRatePaceChart";
import RunsInSelection from "@/features/dashboard/RunsInSelection";
import { demoRuns } from "@/data/fixtures/demoRuns";
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
    colors: "border-teal/25 border-t-teal bg-teal/10",
  },
  {
    label: "Total Distance",
    unit: "miles",
    image: distanceIcon,
    colors: "border-gold/40 border-t-gold bg-gold/15",
  },
  {
    label: "Avg Pace",
    unit: "min/mi",
    image: stopwatchIcon,
    colors: "border-berry/25 border-t-berry bg-berry/10",
  },
  {
    label: "Avg Heart Rate",
    unit: "bpm",
    image: heartRateIcon,
    colors: "border-orange/30 border-t-orange bg-orange/10",
  },
];

export default function Home() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="w-fit border-b-4 border-gold pb-2 text-3xl font-bold tracking-tight text-brand md:text-4xl">
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
          aria-label="Distance and pace over time"
          className="h-80 min-w-0 rounded-lg border border-gold/30 border-t-4 border-t-gold bg-gold/5"
        >
          <DistanceTimePaceChart runs={demoRuns} />
        </section>
        <section
          aria-label="Temperature, heart rate and pace"
          className="h-80 min-w-0 rounded-lg border border-orange/30 border-t-4 border-t-orange bg-orange/5"
        >
          <TemperatureHeartRatePaceChart runs={demoRuns} />
        </section>
      </div>
      <section
        aria-label="Runs in Selection"
        className="min-h-96 min-w-0 rounded-lg border border-teal/25 border-t-4 border-t-teal bg-teal/5"
      >
        <RunsInSelection runs={demoRuns} />
      </section>
    </div>
  );
}
