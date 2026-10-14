export function formatNumber(value: number | null, decimals = 0) {
  return value !== null && Number.isFinite(value)
    ? value.toLocaleString("en-US", { maximumFractionDigits: decimals })
    : "—";
}

export function formatPace(value: number | null) {
  if (value === null || !Number.isFinite(value) || value <= 0) return "—";
  const seconds = Math.round(value * 60);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatTotalTime(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return "—";
  const seconds = Math.round(value);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

export function formatSpeed(pace: number | null) {
  return pace !== null && Number.isFinite(pace) && pace > 0
    ? formatNumber(60 / pace, 2)
    : "—";
}
