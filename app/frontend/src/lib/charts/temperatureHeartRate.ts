export type TemperaturePaceRun = {
  pace: number | null;
  heartRate: number | null;
  temperature: number | null;
};

export const temperatureRanges = [
  { id: "under-60", label: "<60°F", min: -Infinity, max: 60, color: "#8ecae6" },
  { id: "60-70", label: "60–70°F", min: 60, max: 70, color: "#f3c56a" },
  { id: "70-80", label: "70–80°F", min: 70, max: 80, color: "#f28e2b" },
  { id: "80-plus", label: "80°F+", min: 80, max: Infinity, color: "#d73027" },
];

/** Convert an entered m:ss pace to decimal minutes per mile. */
export function parsePaceInput(value: string): number | null {
  const match = /^(\d{1,3}):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  const pace = Number(match[1]) + Number(match[2]) / 60;
  return pace > 0 ? pace : null;
}

/** Each run contributes equally; temperature ranges include their lower bound. */
export function temperatureHeartRateSummary(runs: readonly TemperaturePaceRun[], minPace: number, maxPace: number) {
  const validRange = Number.isFinite(minPace) && minPace > 0 && Number.isFinite(maxPace) && maxPace >= minPace;
  return temperatureRanges.map((range) => {
    const members = runs.filter((run) => validRange &&
      run.pace !== null && Number.isFinite(run.pace) && run.pace >= minPace && run.pace <= maxPace &&
      run.heartRate !== null && Number.isFinite(run.heartRate) && run.heartRate > 0 &&
      run.temperature !== null && Number.isFinite(run.temperature) &&
      run.temperature >= range.min && run.temperature < range.max,
    );
    const averageHeartRate = members.length
      ? members.reduce((sum, run) => sum + run.heartRate!, 0) / members.length : null;
    return { ...range, count: members.length, averageHeartRate };
  });
}
