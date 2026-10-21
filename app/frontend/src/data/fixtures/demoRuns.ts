import type { CurrentRun } from "@/components/charts/CurrentRunsList";

// Fictional, temporary UI fixtures. These are not measured workout records.
export const demoRuns: CurrentRun[] = [
  {
    id: "demo-run-1",
    date: "2025-09-27",
    totalTimeSeconds: 2700,
    totalCalories: 510,
    isIndoor: false,
    averageCadenceSpm: 164,
    sleepHours: 7.2,
    distanceMiles: 5,
    pace: 9,
    heartRate: 148,
    temperature: 62,
    elevationFeet: 180,
  },
  {
    id: "demo-run-2",
    date: "2025-09-29",
    totalTimeSeconds: 1632,
    totalCalories: 325,
    isIndoor: true,
    averageCadenceSpm: 172,
    sleepHours: 8.1,
    distanceMiles: 3.2,
    pace: 8.5,
    heartRate: 155,
    temperature: 71,
    elevationFeet: 95,
  },
];
