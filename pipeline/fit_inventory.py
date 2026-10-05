#!/usr/bin/env python3
"""Inventory FIT data without exporting individual GPS/HR samples."""
import argparse
import csv
import json
import math
import re
import sys
import warnings
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import fitdecode

LEVELS = ('workout_session', 'lap', 'timestamped_record', 'weather', 'other_timestamped', 'metadata')
METRICS = {
    'temperature': r'temperature|(^|_)temp($|_)',
    'humidity': r'humidity',
    'wind_speed': r'wind.*speed|speed.*wind',
    'wind_direction': r'wind.*(direction|bearing)|(?:direction|bearing).*wind',
    'weather_conditions': r'weather.*(condition|status)|condition.*weather|^condition$|^conditions$',
    'gps': r'(?:position|start_position|end_position)_(?:lat|long)$|^(?:nec|swc)_(?:lat|long)$|^gps_accuracy$|^gps_(?:latitude|longitude)$',
    'elevation': r'altitude|elevation|total_ascent|total_descent',
    'heart_rate': r'(^|_)(?:heart_rate|hr)(?:$|_(?:bpm|value))',
    'cadence': r'cadence',
    'power': r'(^|_)power($|_)|^normalized_power$',
    'ground_contact_time': r'stance_time(?!_balance)|ground_contact_time|(^|_)gct($|_)',
    'ground_contact_balance': r'stance_time_balance|ground_contact.*balance|gct.*balance',
    'vertical_oscillation': r'vertical_oscillation',
    'vertical_ratio': r'vertical_ratio',
    'stride_length': r'(?:stride|step)_length',
    'speed': r'(^|_)speed($|_)',
    'distance': r'(^|_)distance($|_)',
    'respiration_rate': r'respiration_rate|breathing_rate',
}
PATTERNS = {name: re.compile(pattern) for name, pattern in METRICS.items()}


def usable(value):
    """FIT invalid sentinels decode as None. Zero and False are valid values."""
    if value is None:
        return False
    if isinstance(value, float):
        return math.isfinite(value)
    if isinstance(value, (tuple, list)):
        return any(usable(item) for item in value)
    if isinstance(value, (str, bytes)):
        return bool(value.strip())
    return True


def iso(value):
    if isinstance(value, datetime):
        # FIT date_time is UTC; local_timestamp is intentionally never used.
        return value.replace(tzinfo=value.tzinfo or timezone.utc).astimezone(timezone.utc).isoformat()
    return None


def level(message):
    if message.name in ('session', 'activity'):
        return 'workout_session'
    if message.name == 'lap':
        return 'lap'
    if message.name == 'record':
        return 'timestamped_record'
    if message.name.startswith('weather'):
        return 'weather'
    if message.name in ('file_id', 'file_creator', 'device_info', 'developer_data_id', 'field_description', 'sport'):
        return 'metadata'
    if any(f.name == 'timestamp' and usable(f.value) for f in message.fields):
        return 'other_timestamped'
    return 'metadata'


def field_key(message, field):
    definition = field.field_def
    dev = getattr(definition, 'dev_data_index', None)
    return (message.global_mesg_num, message.name, level(message), field.def_num,
            field.name, dev if dev is not None else '', bool(field.is_expanded))


def field_labels(key):
    return dict(zip(('message_number', 'message_type', 'level', 'field_number',
                     'field_name', 'developer_data_index', 'is_expanded'), key))


def parse_file(path, root):
    result = {'file': path.relative_to(root).as_posix(), 'size_bytes': path.stat().st_size,
              'status': 'failed', 'error': '', 'warnings': [], 'session_count': 0,
              'is_workout': False, 'workout_start_utc': None, 'date_source': None,
              'record_first_utc': None, 'record_last_utc': None}
    messages = Counter()
    fields = {}
    session_dates, record_dates, activity_dates, created_dates = [], [], [], []
    file_type = None
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter('always')
        try:
            with fitdecode.FitReader(path, check_crc=fitdecode.CrcCheck.RAISE,
                                     error_handling=fitdecode.ErrorHandling.RAISE) as reader:
                for frame in reader:
                    if not isinstance(frame, fitdecode.FitDataMessage):
                        continue
                    messages[(frame.global_mesg_num, frame.name, level(frame))] += 1
                    if frame.name == 'session':
                        result['session_count'] += 1
                    for field in frame.fields:
                        key = field_key(frame, field)
                        entry = fields.setdefault(key, {'occurrences': 0, 'non_null_occurrences': 0,
                                                         'units': set(), 'types': set()})
                        entry['occurrences'] += 1
                        entry['non_null_occurrences'] += int(usable(field.value))
                        if field.units:
                            entry['units'].add(str(field.units))
                        entry['types'].add(str(getattr(field.type, 'name', field.type)))
                        date = iso(field.value)
                        if frame.name == 'file_id' and field.name == 'type':
                            file_type = field.value
                        if date:
                            if frame.name == 'session' and field.name == 'start_time':
                                session_dates.append(date)
                            elif frame.name == 'record' and field.name == 'timestamp':
                                record_dates.append(date)
                            elif frame.name == 'activity' and field.name == 'timestamp':
                                activity_dates.append(date)
                            elif frame.name == 'file_id' and field.name == 'time_created':
                                created_dates.append(date)
            if not messages:
                raise ValueError('No FIT data messages found')
            result['status'] = 'valid'
        except Exception as exc:
            result['error'] = f'{type(exc).__name__}: {exc}'
        result['warnings'] = sorted({str(w.message) for w in caught})
    result['is_workout'] = bool(result['session_count'] or any(k[1] == 'record' for k in messages) or file_type == 'activity')
    for source, dates in (('session.start_time', session_dates), ('record.timestamp', record_dates),
                          ('activity.timestamp (end-time fallback)', activity_dates),
                          ('file_id.time_created (creation-time fallback)', created_dates)):
        if dates:
            result['workout_start_utc'] = min(dates)
            result['date_source'] = source
            break
    result['record_first_utc'] = min(record_dates, default=None)
    result['record_last_utc'] = max(record_dates, default=None)
    result['file_type'] = file_type
    return result, messages, fields


def write_csv(path, rows, columns):
    with path.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: json.dumps(v, ensure_ascii=False) if isinstance(v, (list, dict)) else v
                             for k, v in row.items()})


def run(root, output, limit=None):
    files = sorted(p for p in root.rglob('*') if p.is_file() and p.suffix.lower() == '.fit')
    if limit is not None:
        files = files[:limit]
    output.mkdir(parents=True, exist_ok=True)
    file_rows, per_file_rows = [], []
    totals, message_totals = {}, {}
    metric_sets = defaultdict(set)
    metric_present = defaultdict(set)
    metric_fields = defaultdict(set)
    for index, path in enumerate(files, 1):
        result, messages, fields = parse_file(path, root)
        file_rows.append(result)
        if result['status'] == 'valid':
            workout = result['is_workout']
            for key, count in messages.items():
                entry = message_totals.setdefault(key, Counter())
                entry['occurrences'] += count
                entry['files_present'] += 1
                entry['workouts_present'] += int(workout)
            for key, data in fields.items():
                entry = totals.setdefault(key, {'occurrences': 0, 'non_null_occurrences': 0,
                    'files_present': 0, 'files_with_values': 0, 'workouts_present': 0,
                    'workouts_with_values': 0, 'units': set(), 'types': set()})
                for name in ('occurrences', 'non_null_occurrences'):
                    entry[name] += data[name]
                entry['files_present'] += 1
                entry['files_with_values'] += int(data['non_null_occurrences'] > 0)
                entry['workouts_present'] += int(workout)
                entry['workouts_with_values'] += int(workout and data['non_null_occurrences'] > 0)
                entry['units'].update(data['units'])
                entry['types'].update(data['types'])
                per_file_rows.append({'file': result['file'], **field_labels(key),
                    'occurrences': data['occurrences'], 'non_null_occurrences': data['non_null_occurrences'],
                    'units': sorted(data['units'])})
                if workout and key[2] != 'metadata':
                    normalized = re.sub(r'[^a-z0-9]+', '_', key[4].lower()).strip('_')
                    for metric, pattern in PATTERNS.items():
                        if pattern.search(normalized):
                            for scope in ('any_level', key[2]):
                                metric_present[(metric, scope)].add(result['file'])
                                if data['non_null_occurrences']:
                                    metric_sets[(metric, scope)].add(result['file'])
                                metric_fields[(metric, scope)].add(key)
        if index % 25 == 0 or index == len(files):
            print(f'Parsed {index}/{len(files)} files', file=sys.stderr, flush=True)
    valid = [row for row in file_rows if row['status'] == 'valid']
    workouts = [row for row in valid if row['is_workout']]
    denominator = len(workouts)
    field_rows = []
    for key, data in sorted(totals.items(), key=lambda item: str(item[0])):
        field_rows.append({**field_labels(key), **{k: sorted(v) if isinstance(v, set) else v for k, v in data.items()},
            'workout_coverage_pct': round(100 * data['workouts_with_values'] / denominator, 3) if denominator else 0})
    message_rows = [{'message_number': key[0], 'message_type': key[1], 'level': key[2], **dict(data)}
                    for key, data in sorted(message_totals.items())]
    metric_rows = []
    for metric in METRICS:
        for scope in ('any_level', *LEVELS[:-1]):
            count = len(metric_sets[(metric, scope)])
            metric_rows.append({'metric': metric, 'level': scope, 'workouts_present': len(metric_present[(metric, scope)]),
                'workouts_with_values': count, 'total_workouts': denominator,
                'coverage_pct': round(100 * count / denominator, 3) if denominator else 0,
                'matched_fields': sorted({f'{k[1]}.{k[4]}' for k in metric_fields[(metric, scope)]})})
    dated = [row for row in workouts if row['workout_start_utc']]
    summary = {'input_directory': str(root), 'generated_utc': datetime.now(timezone.utc).isoformat(),
        'parser': f'fitdecode {fitdecode.__version__}', 'total_files': len(files), 'valid_files': len(valid),
        'failed_files': len(files) - len(valid), 'valid_workout_files': denominator,
        'valid_non_workout_files': len(valid) - denominator, 'workouts_missing_date': denominator - len(dated),
        'earliest_workout_utc': min((r['workout_start_utc'] for r in dated), default=None),
        'latest_workout_utc': max((r['workout_start_utc'] for r in dated), default=None),
        'files_with_multiple_sessions': [r['file'] for r in workouts if r['session_count'] > 1],
        'message_type_count': len({k[0] for k in message_totals}), 'field_identity_count': len(field_rows),
        'counting_unit': 'One successfully parsed workout FIT file; multiple sessions in a file count once and are flagged.',
        'validity': 'Complete parse with strict CRC and parser error checking. Failed-file partial data excluded from all coverage.',
        'value_policy': 'Non-null finite nonempty decoded values; zero/False are valid; arrays need at least one valid member.',
        'date_policy': 'UTC session.start_time, then record.timestamp, then activity end time, then file creation time. Source recorded per file.',
        'inventory_policy': 'All decoded data-message fields including unknown/developer/expanded fields; unused definition declarations are not data coverage.',
        'metric_policy': 'Case-insensitive field-name patterns, excluding metadata declarations. Matched fields are listed for review. No metrics inferred from speed/cadence.',
        'metric_patterns': METRICS}
    payload = {'summary': summary, 'files': file_rows, 'messages': message_rows,
               'fields': field_rows, 'metric_coverage': metric_rows}
    (output / 'inventory.json').write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    (output / 'summary.json').write_text(json.dumps(summary, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    write_csv(output / 'files.csv', file_rows, list(file_rows[0]) if file_rows else ['file', 'status', 'error'])
    write_csv(output / 'failed_files.csv', [r for r in file_rows if r['status'] == 'failed'], list(file_rows[0]) if file_rows else ['file','status','error'])
    write_csv(output / 'messages.csv', message_rows, ['message_number','message_type','level','occurrences','files_present','workouts_present'])
    write_csv(output / 'fields.csv', field_rows, list(field_rows[0]) if field_rows else list(field_labels((0,'','',0,'','',False))))
    write_csv(output / 'workout_fields.csv', per_file_rows, ['file',*field_labels((0,'','',0,'','',False)),'occurrences','non_null_occurrences','units'])
    write_csv(output / 'metric_coverage.csv', metric_rows, list(metric_rows[0]))
    print(json.dumps(summary, indent=2))
    return payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', nargs='?', type=Path, default=Path(__file__).parent.parent / 'data' / 'raw' / 'fit')
    parser.add_argument('--output', type=Path, default=Path(__file__).parent.parent / 'data' / 'derived' / 'fit_inventory')
    parser.add_argument('--limit', type=int, help='Optional sample run; omit to scan all files recursively, including hidden directories.')
    args = parser.parse_args()
    root = args.input.resolve()
    if not root.is_dir():
        parser.error(f'Input directory does not exist: {root}')
    if args.limit is not None and args.limit < 1:
        parser.error('--limit must be positive')
    run(root, args.output.resolve(), args.limit)


if __name__ == '__main__':
    main()
