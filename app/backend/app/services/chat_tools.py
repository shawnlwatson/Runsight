"""Data tools the Runsight Assistant can call. Every tool sees only runs that pass the user's active filters."""

import json
import math
import statistics
from datetime import date

from app.models.chat import ChatFilters
from app.services.runs import RUN_FIELDS, runs_with_health
from app.services.summary import add_distance_bounds, dashboard_summary, parse_attribute_filters, run_match

# Metric name the model uses -> (document field, unit and meaning)
METRICS = {
    "pace": ("pace", "min/mile, lower is faster"),
    "distance": ("distanceMiles", "miles"),
    "duration": ("durationMinutes", "minutes"),
    "heartRate": ("heartRate", "average bpm"),
    "cadence": ("averageCadenceSpm", "steps/min"),
    "elevation": ("elevationFeet", "feet"),
    "temperature": ("temperature", "°F"),
    "humidity": ("humidity", "% relative humidity"),
    "calories": ("totalCalories", "workout kcal"),
    "sleep": ("sleepHours", "hours slept the night before"),
    "activeEnergy": ("activeEnergyKcal", "whole-day active kcal, not workout calories"),
    "steps": ("steps", "whole-day step count"),
}
CHAT_FIELDS = RUN_FIELDS + ["humidity", "temperatureSource", "activeEnergyKcal", "steps"]
MAX_LISTED_RUNS = 50
MAX_GROUPS = 72


class ToolError(ValueError):
    """A bad tool argument. The message goes back to the model so it can correct itself."""


class AnalysisScope:
    """The runs the user is currently looking at: their date range, exclusions, and filters."""

    def __init__(self, filters: ChatFilters):
        self.filters = filters
        # Raises ValueError for an unknown range label, which the endpoint reports as 422
        self.attribute_filters = add_distance_bounds(
            parse_attribute_filters(None, filters.elevation, filters.temperature),
            filters.min_distance, filters.max_distance)

    def runs(self, start: str | None = None, end: str | None = None):
        """Filtered runs, oldest first. Tool dates override the selected range when given."""
        first, last = self.dates(start, end)
        match = run_match(first, last, self.filters.excluded_run_ids, self.filters.min_pace,
                          self.filters.max_pace, self.attribute_filters)
        runs = runs_with_health(first, last, CHAT_FIELDS, match)
        for run in runs:
            seconds = run.get("totalTimeSeconds")
            run["durationMinutes"] = seconds / 60 if seconds is not None else None
        return runs

    def dates(self, start: str | None, end: str | None):
        first = parse_date(start) if start else self.filters.start
        last = parse_date(end) if end else self.filters.end
        if first and last and first > last:
            raise ToolError("start must not be after end")
        return first, last

    def describe(self):
        """Plain-language description of the active filters for the system prompt."""
        f = self.filters
        parts = [f"dates {f.start or 'beginning'} to {f.end or 'present'}" if f.start or f.end else "all dates"]
        if f.min_pace is not None or f.max_pace is not None:
            parts.append(f"pace {pace_text(f.min_pace) or 'any'} to {pace_text(f.max_pace) or 'any'} /mi")
        if f.min_distance is not None or f.max_distance is not None:
            parts.append(f"distance {f.min_distance if f.min_distance is not None else 'any'} to "
                         f"{f.max_distance if f.max_distance is not None else 'any'} mi")
        if f.elevation:
            parts.append(f"elevation {f.elevation} ft")
        if f.temperature:
            parts.append(f"temperature {f.temperature} °F")
        if f.excluded_run_ids:
            parts.append(f"{len(f.excluded_run_ids)} run(s) excluded by the user")
        return "; ".join(parts)


def parse_date(value: str):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ToolError(f"Invalid date {value!r}; use YYYY-MM-DD") from None


def metric_field(name: str):
    if name not in METRICS:
        raise ToolError(f"Unknown metric {name!r}; choose from {', '.join(METRICS)}")
    return METRICS[name][0]


def number(value):
    return value if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) else None


def rounded(value, digits=2):
    value = number(value)
    return round(value, digits) if value is not None else None


def pace_text(pace: float | None):
    """Decimal min/mile -> "m:ss"."""
    if number(pace) is None or pace <= 0:
        return None
    seconds = round(pace * 60)
    return f"{seconds // 60}:{seconds % 60:02d}"


def describe_values(values: list[float]):
    if not values:
        return {"n": 0}
    stats = {"n": len(values), "mean": rounded(statistics.fmean(values)), "median": rounded(statistics.median(values)),
             "min": rounded(min(values)), "max": rounded(max(values))}
    if len(values) > 1:
        q1, _, q3 = statistics.quantiles(values, n=4, method="inclusive")
        stats.update(sd=rounded(statistics.stdev(values)), p25=rounded(q1), p75=rounded(q3))
    return stats


def with_pace_text(stats: dict):
    """Add m:ss versions of pace statistics so the model never converts decimals itself."""
    return {**stats, **{f"{key}Text": pace_text(stats[key]) for key in ("mean", "median", "min", "max", "p25", "p75")
                        if key in stats}}


def period_key(day: str, group_by: str):
    year, month = day[:4], int(day[5:7])
    return {"year": year, "quarter": f"{year}-Q{(month - 1) // 3 + 1}", "month": day[:7]}[group_by]


def evidence(n: int, r: float, low: float | None, high: float | None):
    if n < 10:
        return "very limited: fewer than 10 runs, so this could easily change with more data"
    if low is None or low <= 0 <= high:
        return "inconclusive: the 95% interval includes no relationship"
    size = abs(r)
    label = "weak" if size < 0.3 else "moderate" if size < 0.5 else "strong"
    return f"{label} {'positive' if r > 0 else 'negative'} association; correlation alone does not show cause"


# Tools ---------------------------------------------------------------------------------------------

def summarize_period(scope: AnalysisScope, start: str | None = None, end: str | None = None):
    first, last = scope.dates(start, end)
    f = scope.filters
    summary = dashboard_summary(first, last, f.excluded_run_ids, f.min_pace, f.max_pace, scope.attribute_filters)
    for period in summary.values():
        if period:
            period.pop("_id", None)
            period.pop("paceSeconds", None)
            period.pop("paceMiles", None)
            period["avgPaceText"] = pace_text(period["avgPace"])
            for key in ("totalDistanceMiles", "avgPace", "avgHeartRate"):
                period[key] = rounded(period[key])
    summary["period"] = {"start": str(first) if first else None, "end": str(last) if last else None}
    if summary["previous"] is None:
        summary["note"] = "A previous-period comparison needs both a start and an end date."
    return summary


def list_runs(scope: AnalysisScope, start: str | None = None, end: str | None = None, sort_by: str = "date",
              order: str = "desc", limit: int = 20):
    runs = scope.runs(start, end)
    if sort_by != "date":
        field = metric_field(sort_by)
        runs = [run for run in runs if number(run.get(field)) is not None]
        runs.sort(key=lambda run: run[field])
    if order == "desc":
        runs.reverse()
    limit = max(1, min(int(limit), MAX_LISTED_RUNS))
    rows = []
    for run in runs[:limit]:
        row = {"id": run["_id"], "date": run["date"], "paceText": pace_text(run.get("pace"))}
        row.update({name: rounded(run.get(field)) for name, (field, _) in METRICS.items()})
        row["indoor"] = run.get("isIndoor")
        row["temperatureSource"] = run.get("temperatureSource")
        rows.append(row)
    return {"matchingRuns": len(runs), "returned": len(rows), "runs": rows}


def metric_stats(scope: AnalysisScope, metric: str, start: str | None = None, end: str | None = None,
                 group_by: str = "none"):
    field = metric_field(metric)
    if group_by not in ("none", "month", "quarter", "year"):
        raise ToolError("group_by must be none, month, quarter, or year")
    runs = [run for run in scope.runs(start, end) if number(run.get(field)) is not None]
    result = {"metric": metric, "unit": METRICS[metric][1], "overall": describe_values([run[field] for run in runs])}
    if group_by != "none":
        groups: dict[str, list[float]] = {}
        for run in runs:
            groups.setdefault(period_key(run["date"], group_by), []).append(run[field])
        rows = [{"period": key, **{k: v for k, v in describe_values(values).items() if k in ("n", "mean", "median")}}
                for key, values in groups.items()]
        result["groups"] = rows[-MAX_GROUPS:]
        if len(rows) > MAX_GROUPS:
            result["note"] = f"Only the latest {MAX_GROUPS} groups are shown; use a coarser group_by."
    if metric == "pace":
        result["overall"] = with_pace_text(result["overall"])
        if "groups" in result:
            result["groups"] = [with_pace_text(group) for group in result["groups"]]
    return result


def correlate(scope: AnalysisScope, x: str, y: str, start: str | None = None, end: str | None = None):
    x_field, y_field = metric_field(x), metric_field(y)
    if x_field == y_field:
        raise ToolError("Choose two different metrics")
    pairs = [(run[x_field], run[y_field]) for run in scope.runs(start, end)
             if number(run.get(x_field)) is not None and number(run.get(y_field)) is not None]
    result = {"x": x, "y": y, "units": {x: METRICS[x][1], y: METRICS[y][1]}, "n": len(pairs)}
    if len(pairs) < 3:
        return {**result, "evidence": "not enough runs with both values to measure a relationship"}
    xs, ys = zip(*pairs)
    try:
        r = statistics.correlation(xs, ys)
        rho = statistics.correlation(xs, ys, method="ranked")
        slope = statistics.linear_regression(xs, ys).slope
    except statistics.StatisticsError:
        return {**result, "evidence": "one of the metrics does not vary across these runs"}
    low = high = None
    if len(pairs) > 3 and abs(r) > 0.999999:
        low = high = r  # a perfect correlation has no spread (and atanh would be infinite)
    elif len(pairs) > 3:
        z, se = math.atanh(r), 1 / math.sqrt(len(pairs) - 3)  # Fisher z interval
        low, high = math.tanh(z - 1.96 * se), math.tanh(z + 1.96 * se)
    return {**result, "pearsonR": rounded(r), "r95Interval": [rounded(low), rounded(high)] if low is not None else None,
            "spearmanRho": rounded(rho), "slope": f"{rounded(slope, 4)} {y} per 1 {x}",
            "evidence": evidence(len(pairs), r, low, high)}


def compare_run(scope: AnalysisScope, run_id: str, start: str | None = None, end: str | None = None):
    runs = scope.runs(start, end)
    target = next((run for run in runs if run["_id"] == run_id), None)
    if target is None:
        raise ToolError(f"Run {run_id!r} is not in the selected runs; find ids with list_runs")
    comparison = {}
    for name, (field, unit) in METRICS.items():
        value = number(target.get(field))
        others = [run[field] for run in runs if run is not target and number(run.get(field)) is not None]
        if value is None or not others:
            continue
        below = sum(other < value for other in others) + sum(other == value for other in others) / 2
        comparison[name] = {"value": rounded(value), "typicalMedian": rounded(statistics.median(others)),
                            "percentile": round(100 * below / len(others)), "comparedWith": len(others), "unit": unit}
    return {"run": {"id": run_id, "date": target["date"], "paceText": pace_text(target.get("pace")),
                    "temperatureSource": target.get("temperatureSource")},
            "metrics": comparison,
            "note": "percentile = share of the other selected runs with a lower value"}


TOOLS = {"summarize_period": summarize_period, "list_runs": list_runs, "metric_stats": metric_stats,
         "correlate": correlate, "compare_run": compare_run}

_dates = {
    "start": {"type": "string", "description": "YYYY-MM-DD. Omit to use the user's selected start date."},
    "end": {"type": "string", "description": "YYYY-MM-DD. Omit to use the user's selected end date."},
}
_metric = {"type": "string", "enum": list(METRICS)}

# OpenAI-compatible tool definitions. No additionalProperties: Gemini rejects it, and run_tool rejects unknown arguments
TOOL_DEFINITIONS = [
    {"type": "function", "function": {
        "name": "summarize_period",
        "description": "Run count, total distance, average pace, and average heart rate for a period, plus the "
                       "same-length previous period when both dates are known. Matches the Dashboard tiles.",
        "parameters": {"type": "object", "properties": {**_dates}}}},
    {"type": "function", "function": {
        "name": "list_runs",
        "description": "Individual runs with every metric. Sort by date or a metric to find the fastest, longest, "
                       "hottest, or other extreme runs. Returns run ids for compare_run.",
        "parameters": {"type": "object", "properties": {
            **_dates,
            "sort_by": {"type": "string", "enum": ["date", *METRICS]},
            "order": {"type": "string", "enum": ["asc", "desc"], "description": "desc = newest or largest first"},
            "limit": {"type": "integer", "minimum": 1, "maximum": MAX_LISTED_RUNS},
        }}}},
    {"type": "function", "function": {
        "name": "metric_stats",
        "description": "Distribution of one metric (n, mean, median, spread). Group by month, quarter, or year "
                       "to see how it changed over time.",
        "parameters": {"type": "object", "properties": {
            "metric": _metric, **_dates,
            "group_by": {"type": "string", "enum": ["none", "month", "quarter", "year"]},
        }, "required": ["metric"]}}},
    {"type": "function", "function": {
        "name": "correlate",
        "description": "Relationship between two metrics across runs: Pearson r with a 95% interval, Spearman rho, "
                       "slope, sample size, and a plain evidence label. Use for every claim that two things are related.",
        "parameters": {"type": "object", "properties": {"x": _metric, "y": _metric, **_dates},
                       "required": ["x", "y"]}}},
    {"type": "function", "function": {
        "name": "compare_run",
        "description": "Compare one run with the other selected runs: each metric's value, the typical median, and "
                       "its percentile. Use to explain an unusually good or bad run.",
        "parameters": {"type": "object", "properties": {"run_id": {"type": "string"}, **_dates},
                       "required": ["run_id"]}}},
]


def run_tool(scope: AnalysisScope, name: str, arguments: str):
    """Execute a tool call and return JSON for the model. Bad arguments come back as an error, not an exception."""
    try:
        tool = TOOLS.get(name)
        if tool is None:
            raise ToolError(f"Unknown tool {name!r}")
        try:
            args = json.loads(arguments or "{}")
        except json.JSONDecodeError:
            raise ToolError("Arguments must be a JSON object") from None
        if not isinstance(args, dict):
            raise ToolError("Arguments must be a JSON object")
        result = tool(scope, **args)
    except (ValueError, TypeError) as error:  # ToolError, bad limit, or unexpected argument names
        result = {"error": str(error)}
    return json.dumps(result, default=str)
