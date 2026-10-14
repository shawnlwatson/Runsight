import type { CurrentRun } from "@/types/run";
import { formatNumber, formatPace, formatSpeed, formatTotalTime } from "@/lib/runFormatters";

type Props = {
  run: CurrentRun;
};

export default function IndividualRun({ run }: Props) {
  const workoutMetrics = [
    { label: "Total Time", value: formatTotalTime(run.totalTimeSeconds), unit: "h:mm:ss", color: "text-gold" },
    { label: "Average Pace", value: formatPace(run.pace), unit: "min/mi", color: "text-orange" },
    { label: "Average Speed", value: formatSpeed(run.pace), unit: "mph", color: "text-gold" },
    { label: "Average Heart Rate", value: formatNumber(run.heartRate), unit: "bpm", color: "text-orange" },
    { label: "Total Calories", value: formatNumber(run.totalCalories), unit: "kcal", color: "text-orange" },
    { label: "Average Cadence", value: formatNumber(run.averageCadenceSpm), unit: "steps/min", color: "text-gold" },
  ];

  return (
    <article
      aria-label={`Run summary for ${run.date}`}
      tabIndex={0}
      className="h-full overflow-y-auto overscroll-contain bg-background p-5 text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
    >
      <div className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-4 rounded-2xl bg-brand p-5 text-on-brand">
          <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-sm text-gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"
              strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5">
              <circle cx="15" cy="4" r="2" />
              <path d="m12 8 3 4 5 1 M4 11l5-3 3 1-2 6 4 3v4 M10 15l-4 5H2" />
            </svg>
            {run.isIndoor === true ? "Indoor Run" : run.isIndoor === false ? "Outdoor Run" : "Run Summary"}
          </div>
          <p className="mt-2 text-sm text-on-brand/80">
            <time dateTime={run.date}>{run.date.slice(2)}</time>
          </p>
          {run.id.startsWith("demo-") && (
            <p className="mt-2 w-fit rounded-full border border-gold/40 px-2 py-0.5 text-xs text-gold">
              Fictional preview run
            </p>
          )}
          </div>
          <dl className="shrink-0 text-right">
            <dt className="text-xs font-medium uppercase tracking-widest text-on-brand/75">Total Distance</dt>
            <dd className="mt-1 flex flex-wrap items-baseline justify-end gap-2">
              <span className="text-5xl font-semibold tracking-tight text-gold tabular-nums">
                {formatNumber(run.distanceMiles, 2)}
              </span>
              <span className="text-sm text-on-brand/80">miles</span>
            </dd>
          </dl>
        </header>

        <section aria-label="Workout details">
          <h3 className="mb-3 text-base font-semibold">Workout Details</h3>
          <dl className="grid grid-cols-2 gap-3">
            {workoutMetrics.map((metric) => (
              <div key={metric.label} className="min-w-0 rounded-xl bg-navy p-4 text-on-brand">
                <dt className="text-xs leading-5 text-on-brand/80">{metric.label}</dt>
                <dd className="mt-2">
                  <span className={`block break-words text-2xl font-semibold tabular-nums ${metric.color}`}>
                    {metric.value}
                  </span>
                  <span className="mt-1 block text-xs text-on-brand/70">{metric.unit}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="Heart rate details" className="rounded-xl border border-berry/20 bg-surface p-4">
          <h3 className="text-base font-semibold text-berry">Heart Rate</h3>
          <p className="mt-2 text-3xl font-semibold text-berry tabular-nums">
            {formatNumber(run.heartRate)} <span className="text-sm font-normal">bpm average</span>
          </p>
          <p className="mt-3 border-t border-berry/15 pt-3 text-sm leading-6 text-muted">
            Heart-rate samples and zones are not available for this run yet.
          </p>
        </section>

        <section aria-label="Run conditions" className="rounded-xl border border-gold/30 bg-surface p-4">
          <h3 className="text-base font-semibold">Conditions &amp; Elevation</h3>
          <dl className="mt-3 divide-y divide-border text-sm">
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-muted">Temperature</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(run.temperature, 1)} °F</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 py-2">
              <dt className="text-muted">Elevation</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(run.elevationFeet)} ft</dd>
            </div>
          </dl>
        </section>

        <section aria-label="Run splits" className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-base font-semibold">Splits</h3>
          <p className="mt-2 text-sm leading-6 text-muted">Mile-by-mile split data is not available for this run yet.</p>
        </section>

        <section aria-label="Run route" className="rounded-xl border border-teal/20 bg-surface p-4">
          <h3 className="text-base font-semibold text-brand">Route</h3>
          <div className="mt-3 flex min-h-24 items-center justify-center rounded-lg border border-dashed border-teal/30 bg-teal/5 p-4">
            <p className="text-center text-sm leading-6 text-muted">GPS route data is not available for this run yet.</p>
          </div>
        </section>
      </div>
    </article>
  );
}
