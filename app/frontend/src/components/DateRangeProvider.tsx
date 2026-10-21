"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { getPreviousPeriod } from "@/lib/periodComparison";

type DateRangeContextValue = {
  fromDate: string;
  toDate: string;
  setFromDate: (value: string) => void;
  setToDate: (value: string) => void;
  previousPeriod: ReturnType<typeof getPreviousPeriod>;
};

const DateRangeContext = createContext<DateRangeContextValue | null>(null);

export default function DateRangeProvider({ children }: { children: ReactNode }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  return (
    <DateRangeContext.Provider value={{
      fromDate,
      toDate,
      setFromDate,
      setToDate,
      previousPeriod: getPreviousPeriod(fromDate, toDate),
    }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const context = useContext(DateRangeContext);
  if (!context) throw new Error("useDateRange requires DateRangeProvider");
  return context;
}
