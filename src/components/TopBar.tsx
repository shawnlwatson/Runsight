"use client";

import Link from "next/link";
import { useDateRange } from "@/components/DateRangeProvider";

export default function TopBar() {
  const { fromDate, toDate, setFromDate, setToDate } = useDateRange();

  return (
    <header className="flex min-h-12 shrink-0 flex-wrap items-center gap-x-4 gap-y-2
    border-b border-gold/35 bg-brand px-6 py-2 md:px-10">
      <span className="text-xl font-bold leading-none
      tracking-tight text-gold md:-translate-x-15">
        Runsight
      </span>
      <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <button
          type="button"
          onClick={() => {
            setFromDate("");
            setToDate("");
          }}
          className="cursor-pointer rounded border border-gold bg-gold px-3 py-1 text-sm font-semibold text-navy hover:bg-gold/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          All Time
        </button>
        <label className="flex items-center gap-2 text-sm font-medium text-gold">
          From
          <input
            type="date"
            name="from"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
            className="min-w-0 rounded border border-gold/60 bg-surface px-2 py-1 text-sm text-foreground scheme-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
        <label className="flex items-center gap-2 text-sm font-medium text-gold">
          To
          <input
            type="date"
            name="to"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
            className="min-w-0 rounded border border-gold/60 bg-surface px-2 py-1 text-sm text-foreground scheme-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </label>
      <Link href="/login"
        className="inline-flex items-center gap-2 rounded
        px-2 py-1 text-sm font-medium text-gold hover:bg-on-brand/10
        focus-visible:outline-2 focus-visible:outline-offset-2
        focus-visible:outline-accent"
      >
        <svg
           xmlns="http://www.w3.org/2000/svg"
           width="20"
           height="20"
           viewBox="0 0 20 20"
           fill="none"
           stroke="currentColor"
           strokeWidth="1.75"
           strokeLinecap="round"
           strokeLinejoin="round"
           aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2"/>
        </svg>
        <span>Account</span>
        </Link>
      </div>
    </header>
  );
}
