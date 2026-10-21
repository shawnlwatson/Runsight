import { demoRuns } from "@/data/fixtures/demoRuns";
import type { FatigueRun } from "@/types/fatigue";

// Fictional health joins for UI preview, not measured or inferred health values.
const previewFatigue = [
  { activeEnergyKcal: 780, steps: 12400 },
  { activeEnergyKcal: 620, steps: 9800 },
];

export const demoFatigueRuns: FatigueRun[] = demoRuns.map((run, index) => ({
  id: run.id,
  date: run.date,
  sleepHours: run.sleepHours,
  pace: run.pace,
  activeEnergyKcal: previewFatigue[index]?.activeEnergyKcal ?? null,
  steps: previewFatigue[index]?.steps ?? null,
}));
