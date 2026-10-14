const DAY_MS = 86_400_000;

function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

export function getPreviousPeriod(from: string, to: string) {
  const start = parseDate(from);
  const end = parseDate(to);
  if (start === null || end === null || end < start) return null;

  // UTC arithmetic counts inclusive calendar days without DST offsets.
  const duration = end - start + DAY_MS;
  return {
    from: new Date(start - duration).toISOString().slice(0, 10),
    to: new Date(start - DAY_MS).toISOString().slice(0, 10),
  };
}

export function getPercentageChange(current: number | null, previous: number | null) {
  if (current === null || previous === null || previous <= 0) return null;
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const change = ((current - previous) / previous) * 100;
  return Number.isFinite(change) ? change : null;
}
