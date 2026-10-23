import type { ReactNode } from "react";

type FilterBarProps = {
  children?: ReactNode;
};

const filters = [
  {
    name: "distance",
    label: "Distance (mi)",
    allLabel: "All distances",
    options: [
      ...Array.from({ length: 9 }, (_, index) => `${index + 1}–${index + 2}`),
      "10+",
    ],
  },
  {
    name: "elevation",
    label: "Elevation (ft)",
    allLabel: "All elevations",
    options: [
      ...Array.from({ length: 5 }, (_, index) => `${index * 100}–${(index + 1) * 100}`),
      "500+",
    ],
  },
  {
    name: "temperature",
    label: "Temperature (°F)",
    allLabel: "All temperatures",
    options: [
      "<30",
      ...Array.from({ length: 6 }, (_, index) => `${30 + index * 10}–${40 + index * 10}`),
      "90+",
    ],
  },
];

export default function FilterBar({ children }: FilterBarProps) {
  return (
    <section
      aria-label="Filters"
      className="flex min-h-12 flex-wrap items-center gap-4
      rounded-lg border border-border bg-surface-muted px-4 py-3
      text-foreground"
    >
      <form className="flex w-full flex-wrap items-center gap-4">
        <strong className="text-sm font-bold text-foreground">Filter:</strong>
        {filters.map((filter) => (
          <label
            key={filter.name}
            className="flex items-center gap-2 text-sm font-medium"
          >
            {filter.label}
            <select
              name={filter.name}
              defaultValue=""
              className="rounded border border-control-border bg-surface px-3 py-1.5 text-sm text-foreground scheme-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              <option value="">{filter.allLabel}</option>
              {filter.options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ))}
        {children}
        <button
          type="reset"
          className="inline-flex cursor-pointer items-center gap-2 rounded border border-brand bg-brand px-3 py-1.5 text-sm font-semibold text-on-brand transition-colors hover:bg-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="h-4 w-4 shrink-0"
          >
            <path d="M3 10a9 9 0 1 1 2.5 8.5 M3 4v6h6" />
          </svg>
          Reset filters
        </button>
      </form>
    </section>
  );
}
