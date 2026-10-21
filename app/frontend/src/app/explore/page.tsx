import FilterBar from "@/components/FilterBar";
import CustomViewsChart from "@/features/explore/CustomViewsChart";
import OutliersChart from "@/features/explore/OutliersChart";
import { demoRuns } from "@/data/fixtures/demoRuns";

export default function ExplorePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="w-fit border-b-4 border-gold pb-2 text-3xl font-bold tracking-tight text-brand md:text-4xl">
          Explore
        </h1>
      </header>
      <FilterBar />
      <section aria-label="Custom views" className="min-w-0 rounded-lg border border-teal/25 border-t-4 border-t-teal bg-surface">
        <CustomViewsChart runs={demoRuns} />
      </section>
      <section aria-label="Outlier run comparison" className="min-w-0 overflow-hidden rounded-lg border border-teal/25 border-t-4 border-t-teal bg-surface">
        <OutliersChart runs={demoRuns} />
      </section>
    </div>
  );
}
