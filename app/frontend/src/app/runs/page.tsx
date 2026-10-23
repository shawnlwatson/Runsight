import RunsBrowser from "@/features/runs/RunsBrowser";
import { fetchRuns } from "@/lib/api";

export default async function RunsPage() {
  const runs = await fetchRuns();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="w-fit border-b-2 border-divider pb-2 text-3xl font-bold tracking-tight text-brand md:text-4xl">
          Runs
        </h1>
        <p className="mt-2 text-sm text-muted md:text-base">
          Select a run to view its details, or check multiple runs to compare.
        </p>
      </header>
      <RunsBrowser runs={runs} />
    </div>
  );
}
