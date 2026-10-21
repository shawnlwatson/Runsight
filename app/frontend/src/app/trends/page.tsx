import PaceTimeChart from "@/features/trends/PaceTimeChart";
import PaceTempChart from "@/features/trends/PaceTempChart";
import VolumePaceChart from "@/features/trends/VolumePaceChart";
import { demoRuns } from "@/data/fixtures/demoRuns";

export default function TrendsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="w-fit border-b-4 border-gold pb-2 text-3xl font-bold tracking-tight text-brand md:text-4xl">
          Trends
        </h1>
      </header>
      <section
        aria-label="Pace over time"
        className="h-96 w-full min-w-0 rounded-lg border border-berry/25 border-t-4 border-t-berry bg-berry/5"
      >
        <PaceTimeChart runs={demoRuns} />
      </section>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section
          aria-label="Pace versus temperature"
          className="h-96 min-w-0 rounded-lg border border-teal/25 border-t-4 border-t-teal bg-teal/5"
        >
          <PaceTempChart runs={demoRuns} />
        </section>
        <section
          aria-label="Future chart"
          className="h-96 min-w-0 rounded-lg border border-teal/25 border-t-4 border-t-teal bg-teal/5"
        >
          <h2 className="px-4 pt-3 text-base font-semibold text-foreground">
            To Build: What moves with what Chart
          </h2>
        </section>
      </div>
      <section
        aria-label="Weekly volume and pace"
        className="h-96 w-full min-w-0 rounded-lg border border-gold/25 border-t-4 border-t-gold bg-gold/5"
      >
        <VolumePaceChart runs={demoRuns} />
      </section>
    </div>
  );
}
