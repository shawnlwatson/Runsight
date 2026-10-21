export type VolumeRun = {
  date: string;
  distanceMiles: number | null;
  pace: number | null;
  totalTimeSeconds?: number | null;
};

export type WeeklyVolume = {
  weekStart: number;
  runCount: number;
  miles: number;
  pace: number | null;
  paceMiles: number;
};

const DAY = 86_400_000;

function parseDay(value: string) {
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
    ? time : NaN;
}

// Calendar weeks start Monday. Filter first so boundary weeks include only selected runs.
export function weeklyVolume(runs: readonly VolumeRun[], fromDate = "", toDate = ""): WeeklyVolume[] {
  const start = fromDate ? parseDay(fromDate) : -Infinity;
  const end = toDate ? parseDay(toDate) : Infinity;
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return [];
  const weeks = new Map<number, WeeklyVolume & { minutes: number }>();
  for (const run of runs) {
    const time = parseDay(run.date);
    if (!Number.isFinite(time) || time < start || time > end) continue;
    const weekStart = time - ((new Date(time).getUTCDay() + 6) % 7) * DAY;
    const week = weeks.get(weekStart) ?? {
      weekStart, runCount: 0, miles: 0, pace: null, paceMiles: 0, minutes: 0,
    };
    week.runCount++;
    const miles = run.distanceMiles;
    if (miles !== null && Number.isFinite(miles) && miles > 0) {
      week.miles += miles;
      const seconds = run.totalTimeSeconds;
      const minutes = seconds != null && Number.isFinite(seconds) && seconds > 0
        ? seconds / 60
        : run.pace !== null && Number.isFinite(run.pace) && run.pace > 0
          ? run.pace * miles : null;
      if (minutes !== null) {
        week.minutes += minutes;
        week.paceMiles += miles;
      }
    }
    weeks.set(weekStart, week);
  }
  return [...weeks.values()].sort((a, b) => a.weekStart - b.weekStart)
    .map(({ minutes, ...week }) => ({ ...week, pace: week.paceMiles > 0 ? minutes / week.paceMiles : null }));
}
