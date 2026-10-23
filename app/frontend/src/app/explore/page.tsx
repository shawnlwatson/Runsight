import FilterBar from "@/components/FilterBar";
import CustomViewsChart from "@/features/explore/CustomViewsChart";
import OutliersChart from "@/features/explore/OutliersChart";
import { fetchRuns } from "@/lib/api";

export default async function ExplorePage() {
  const runs = await fetchRuns();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="w-fit border-b-2 border-divider pb-2 text-3xl font-bold tracking-tight text-brand md:text-4xl">
          Explore
        </h1>
      </header>
      <FilterBar />
      <section aria-label="Custom views" className="min-w-0 rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface">
        <CustomViewsChart runs={runs} />
      </section>
      <section aria-label="Outlier run comparison" className="min-w-0 overflow-hidden rounded-lg border border-border border-t-2 border-t-accent/30 bg-surface">
        <OutliersChart runs={runs} />
      </section>
    </div>
  );
}
