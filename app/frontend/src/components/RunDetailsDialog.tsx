"use client";

import { useEffect, useId, useRef } from "react";
import { useAnalysis } from "@/components/AnalysisProvider";
import IndividualRun from "@/components/charts/individualRun";
import type { CurrentRun } from "@/types/run";

type Props = {
  selectedRun: CurrentRun | null;
  onClose: () => void;
};

export default function RunDetailsDialog({ selectedRun, onClose }: Props) {
  const { excludedRunIds } = useAnalysis();
  const activeRun = selectedRun && !excludedRunIds.includes(selectedRun.id) ? selectedRun : null;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dialogTitleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!activeRun || !dialog) return;
    if (!dialog.open) dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, [activeRun]);

  return (
      <dialog
        ref={dialogRef}
        aria-labelledby={dialogTitleId}
        onClose={onClose}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) {
            event.currentTarget.close();
          }
        }}
        className="fixed inset-0 m-auto h-[480px] max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-surface p-0 text-foreground shadow-2xl backdrop:bg-navy/50 md:w-[33.333vw] md:min-w-80"
      >
        <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-surface-muted px-5 py-3">
            <h2 id={dialogTitleId} className="text-lg font-bold text-foreground">Run Details</h2>
          <button type="button" aria-label="Close run details"
            onClick={() => dialogRef.current?.close()}
            className="-mr-2 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
              <path d="m6 6 12 12 M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="min-h-0 flex-1">
          {activeRun && <IndividualRun run={activeRun} />}
        </div>
        </div>
      </dialog>
  );
}
