export type CurrentRun = {
  id: string;
  date: string; // Workout calendar date, YYYY-MM-DD.
  totalTimeSeconds: number | null;
  totalCalories: number | null; // Kilocalories.
  isIndoor: boolean | null; // Null means the environment is unknown.
  averageCadenceSpm: number | null; // Normalized steps/min, not raw FIT strides/min.
  distanceMiles: number | null;
  pace: number | null; // Decimal minutes per mile.
  heartRate: number | null; // Average bpm.
  elevationFeet: number | null;
  temperature: number | null; // Degrees Fahrenheit.
  sleepHours?: number | null; // Prior-night sleep; supplied by a future health-data join.
};
