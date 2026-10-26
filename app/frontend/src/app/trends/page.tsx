import PaceTimeChart from "@/features/trends/PaceTimeChart";
import PaceTempChart from "@/features/trends/PaceTempChart";
import VolumePaceChart from "@/features/trends/VolumePaceChart";
import { fetchRuns } from "@/lib/api";

export default async function TrendsPage() {
  const runs = await fetchRuns();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="w-fit border-b-2 border-divider pb-2 text-3xl font-bold tracking-tight text-brand md:text-4xl">
          Trends
        </h1>
      </header>
      <section
        aria-label="Pace consistency over time"
        className="h-96 w-full min-w-0 rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface-muted"
      >
        <PaceTimeChart runs={runs} />
      </section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          aria-label="Pace versus temperature"
          className="h-96 min-w-0 rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface-muted"
        >
          <PaceTempChart runs={runs} />
        </section>
        <section
          aria-label="Future chart"
          className="h-96 min-w-0 rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface-muted"
        >
          <h2 className="px-4 pt-3 text-base font-semibold text-foreground">
            To Build: What moves with what Chart
          </h2>
        </section>
      </div>
      <section
        aria-label="Weekly volume and pace"
        className="h-96 w-full min-w-0 rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface-muted"
      >
        <VolumePaceChart runs={runs} />
      </section>
    </div>
  );
}
