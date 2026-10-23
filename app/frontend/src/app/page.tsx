import FilterBar from "@/components/FilterBar";
import DistanceTimePaceChart from "@/features/dashboard/DistanceTimePaceChart";
import TemperatureHeartRatePaceChart from "@/features/dashboard/TemperatureHeartRatePaceChart";
import RunsInSelection from "@/features/dashboard/RunsInSelection";
import SummaryTiles from "@/features/dashboard/SummaryTiles";
import { fetchRuns } from "@/lib/api";

export default async function Home() {
  const runs = await fetchRuns();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="w-fit border-b-2 border-divider pb-2 text-3xl font-bold tracking-tight text-brand md:text-4xl">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-muted md:text-base">
          A summary of your running data and key insights.
        </p>
      </header>
      <SummaryTiles />
      <FilterBar />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          aria-label="Distance and pace over time"
          className="h-80 min-w-0 rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface-muted"
        >
          <DistanceTimePaceChart runs={runs} />
        </section>
        <section
          aria-label="Temperature, heart rate and pace"
          className="h-80 min-w-0 rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface-muted"
        >
          <TemperatureHeartRatePaceChart runs={runs} />
        </section>
      </div>
      <section
        aria-label="Runs in Selection"
        className="min-h-96 min-w-0 rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface-muted"
      >
        <RunsInSelection runs={runs} />
      </section>
    </div>
  );
}
