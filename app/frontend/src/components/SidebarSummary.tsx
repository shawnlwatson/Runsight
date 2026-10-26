"use client";

import { usePathname } from "next/navigation";
import SummaryTiles from "@/features/dashboard/SummaryTiles";

const summaryPages = ["/trends", "/runs", "/explore", "/insights"];

export default function SidebarSummary() {
  const pathname = usePathname();
  if (!summaryPages.some((page) => pathname === page || pathname.startsWith(`${page}/`))) return null;

  return <section aria-label="Sidebar running summary" className="-mx-3 mt-6 border-t border-border pt-4">
    <h2 className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wide text-muted">Running summary</h2>
    <SummaryTiles compact />
  </section>;
}
