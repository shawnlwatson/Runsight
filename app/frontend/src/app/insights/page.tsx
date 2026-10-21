import FatigueChart from "@/features/insights/FatigueChart";
import { demoFatigueRuns } from "@/data/fixtures/demoFatigueRuns";

export default function InsightsPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="w-fit border-b-4 border-gold pb-2 text-3xl font-bold tracking-tight text-brand md:text-4xl">
          Insights
        </h1>
      </header>
      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-2">
        <section aria-label="Chatbot placeholder" className="min-h-96 min-w-0 rounded-lg border border-gold/25 border-t-4 border-t-gold bg-gold/5">
          <h2 className="px-4 pt-4 text-base font-semibold text-foreground">To Build: Possibly a chatbot</h2>
        </section>
        <section aria-label="Fatigue parallel coordinates" className="min-w-0 rounded-lg border border-teal/25 border-t-4 border-t-teal bg-surface">
          <FatigueChart runs={demoFatigueRuns} />
          <p className="px-4 pb-3 text-xs text-muted">Fictional preview data · Daily active energy is separate from workout calories.</p>
        </section>
      </div>
    </div>
  );
}
