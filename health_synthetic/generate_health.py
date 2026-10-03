#!/usr/bin/env python3
"""Reproducible HealthFit-shaped test data. Never infer historical physiology."""
import argparse
from collections import Counter
from copy import copy, deepcopy
from datetime import date, datetime, time, timedelta
import hashlib
import importlib.metadata
import json
from pathlib import Path
import re
import tempfile
import zipfile
import xml.etree.ElementTree as ET

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np
import openpyxl
import pandas as pd
from scipy.special import ndtr, ndtri
from scipy.stats import rankdata

BASE = Path(__file__).resolve().parent
MODEL, PRIOR, MEASURED = 'synthetic_model', 'synthetic_prior', 'measured'
NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
MAIN = NS['m']
ET.register_namespace('', MAIN)


def present(value):
    return value is not None and value != ''


def number(value):
    if isinstance(value, timedelta):
        return value.total_seconds() / 3600
    if isinstance(value, time):
        return value.hour + value.minute / 60 + value.second / 3600 + value.microsecond / 3.6e9
    if isinstance(value, (int, float, np.number)):
        return float(value)
    return np.nan


def day(value):
    return value.date() if isinstance(value, datetime) else value


def sheet_data(sheet):
    headers = {c.column: str(c.value).strip() for c in sheet[1] if present(c.value)}
    rows = {}
    original_rows = {}
    for row in sheet.iter_rows(min_row=2):
        if not present(row[0].value):
            continue
        d = day(row[0].value)
        if d in rows:
            raise ValueError(f'Duplicate date in {sheet.title}: {d}; cannot safely merge records')
        rows[d] = {c.column: c.value for c in row if present(c.value)}
        original_rows[d] = row[0].row
    return headers, rows, original_rows


def positive_definite(matrix):
    values, vectors = np.linalg.eigh((matrix + matrix.T) / 2)
    return (vectors * np.maximum(values, 1e-6)) @ vectors.T


def ar_series(rng, n, phi, covariance=None, anchors=None):
    """Stationary AR process; exact scalar AR bridge correction at measured anchors."""
    phi = np.atleast_1d(phi)
    k = len(phi)
    sigma = np.eye(k) if covariance is None else positive_definite(covariance)
    innovation = positive_definite(sigma - phi[:, None] * sigma * phi[None, :])
    output = np.zeros((n, k))
    output[0] = rng.multivariate_normal(np.zeros(k), sigma)
    noise = rng.multivariate_normal(np.zeros(k), innovation, size=n)
    for i in range(1, n):
        output[i] = phi * output[i - 1] + noise[i]
    if anchors:
        for j, known in anchors.items():
            indices = sorted(known)
            if not indices:
                continue
            deviations = {i: known[i] - output[i, j] for i in indices}
            p = float(phi[j])
            for i in range(n):
                left = max((x for x in indices if x <= i), default=None)
                right = min((x for x in indices if x >= i), default=None)
                if left == right:
                    correction = deviations[left]
                elif left is None:
                    correction = p ** (right - i) * deviations[right]
                elif right is None:
                    correction = p ** (i - left) * deviations[left]
                else:
                    a, b, r = p ** (i-left), p ** (right-i), p ** (right-left)
                    correction = ((a-r*b)*deviations[left] + (b-r*a)*deviations[right]) / (1-r*r)
                output[i, j] += correction
    return output


def availability(rng, n, rate, phi):
    """Clustered measurement mask with approximately the measured marginal rate."""
    if rate <= 0:
        return np.zeros(n, dtype=bool)
    if rate >= 1:
        return np.ones(n, dtype=bool)
    x = ar_series(rng, n, [phi])[:, 0]
    # A fixed threshold permits frequency to vary naturally across calendar years.
    return x < ndtri(rate)


def empirical(values, latent):
    values = np.sort(np.asarray(values, float))
    return np.quantile(values, ndtr(latent))


def latent_value(values, value):
    values = np.sort(np.asarray(values, float))
    p = (np.searchsorted(values, value, side='left') + np.searchsorted(values, value, side='right')) / (2 * len(values))
    return float(ndtri(np.clip(p, 0.5 / len(values), 1 - 0.5 / len(values))))


def daily_generate(headers, measured, dates, rng, cfg):
    columns = list(range(2, 10))
    frame = pd.DataFrame({headers[c]: {d: number(r.get(c)) for d, r in measured.items()} for c in columns}).sort_index()
    latent = frame.copy()
    populations, phis, weekday = {}, [], {}
    for c in columns:
        name = headers[c]
        x = frame[name].dropna()
        populations[c] = x.to_numpy()
        latent.loc[x.index, name] = ndtri((rankdata(x) - 0.5) / len(x))
        # Consecutive calendar-day pairs only, never successive sparse measurements.
        pairs = [(latent.loc[d, name], latent.loc[d + timedelta(days=1), name])
                 for d in latent.index if d + timedelta(days=1) in latent.index and
                 pd.notna(latent.loc[d, name]) and pd.notna(latent.loc[d + timedelta(days=1), name])]
        phi = np.corrcoef(np.asarray(pairs).T)[0, 1] if len(pairs) >= 20 else 0.3
        phis.append(float(np.clip(phi if np.isfinite(phi) else 0.3, 0.08, 0.8)))
        weekday[c] = {w: float(latent.loc[[d for d in latent.index if d.weekday() == w], name].mean())
                      * cfg['weekday_strength'] for w in range(7)}
    # VO2 is a separate slow process: do not infer relations from measurement selection.
    phis[columns.index(7)] = cfg['vo2_persistence']
    weekday[7] = dict.fromkeys(range(7), 0.)
    correlations = latent.corr(min_periods=20).fillna(0).to_numpy().copy()
    np.fill_diagonal(correlations, 1)
    correlations[5, :] = 0; correlations[:, 5] = 0; correlations[5, 5] = 1
    covariance = positive_definite((1-cfg['correlation_shrinkage'])*correlations + cfg['correlation_shrinkage']*np.eye(8))
    lookup = {d: i for i, d in enumerate(dates)}
    anchors = {j: {lookup[d]: latent_value(populations[c], number(r[c])) - weekday[c][d.weekday()]
                   for d, r in measured.items() if d in lookup and c in r and np.isfinite(number(r[c]))}
               for j, c in enumerate(columns)}
    simulated = ar_series(rng, len(dates), phis, covariance, anchors)
    masks = {c: availability(rng, len(dates), frame[headers[c]].notna().mean(), cfg['mask_persistence']) for c in columns}
    values, provenance = deepcopy(measured), {}
    for i, d in enumerate(dates):
        row = values.setdefault(d, {})
        for j, c in enumerate(columns):
            if c in row:
                continue
            # Keep observed measurement schedules on original dates; extend their frequency to new dates.
            if d in measured or not masks[c][i]:
                continue
            x = float(empirical(populations[c], simulated[i, j] + weekday[c][d.weekday()]))
            if c in (4, 6, 8, 9):
                x = round(x)
            row[c] = x
            provenance[d, c] = MODEL
    return values, provenance, {'persistence': dict(zip((headers[c] for c in columns), phis)),
        'measurement_rates': {headers[c]: float(frame[headers[c]].notna().mean()) for c in columns},
        'copula_correlation': covariance.tolist(), 'weekday_latent_effects': weekday}


def bounded_allocation(proposal, total, upper):
    # Euclidean projection onto the nonnegative, upper-bounded composition simplex.
    if total > sum(upper) + 1e-9:
        raise ValueError('Infeasible sleep-stage bounds')
    low, high = -max(upper)-total, max(proposal)+total
    for _ in range(70):
        midpoint = (low+high)/2
        allocated = np.clip(np.asarray(proposal)-midpoint, 0, upper)
        if sum(allocated) > total:
            low = midpoint
        else:
            high = midpoint
    allocated = np.clip(np.asarray(proposal)-(low+high)/2, 0, upper)
    return allocated


def sleep_generate(headers, measured, dates, rng, cfg):
    n = len(dates)
    lookup = {d: i for i, d in enumerate(dates)}
    def population(c):
        return np.array([number(r[c]) for r in measured.values() if c in r and np.isfinite(number(r[c]))])
    def series(c, circular=False):
        vals = population(c)
        if circular:
            vals = (vals - 12) % 24 + 12  # unwrap around noon, not midnight
        anchors = {lookup[d]: latent_value(vals, ((number(r[c])-12)%24+12) if circular else number(r[c]))
                   for d, r in measured.items() if c in r and d in lookup}
        latent = ar_series(rng, n, [cfg['persistence_prior']], anchors={0: anchors})[:, 0]
        return empirical(vals, latent)
    inbed_series, efficiency, bedtime = series(5), series(12), series(3, True)
    # Structural relationships are enforced rather than learned from sparse pairwise correlations.
    total_low = np.maximum(population(6).min(), inbed_series-population(7).max())
    total_high = np.minimum(population(6).max(), inbed_series-population(7).min())
    asleep = np.clip(inbed_series*efficiency, total_low, total_high)
    awake = inbed_series-asleep
    stages = np.array([[number(r[c])/number(r[6]) for c in (8, 9, 10)]
                       for r in measured.values() if all(c in r for c in (6, 8, 9, 10))])
    # Conservative empirical composition with modest jitter, not a fitted sleep network.
    stage_noise = ar_series(rng, n, [cfg['stage_persistence_prior']] * 3)
    shares = stages[rng.integers(0, len(stages), n)] * np.exp(0.12 * stage_noise)
    shares /= shares.sum(axis=1)[:, None]
    wake_count = np.rint(series(11)).astype(int)
    groups = [(14, 15, 16), (18, 19, 20), (21, 22, 23)]
    masks = {}
    auxiliary = {}
    # Preserve the observed joint availability of the three auxiliary groups.
    signatures = np.array([[all(c in r for c in group) for group in groups] for r in measured.values()], bool)
    core_aux_rate = float(np.mean(np.all(signatures, axis=1)))
    core_mask = availability(rng, n, core_aux_rate, cfg['mask_persistence'])
    for group in groups:
        masks[group] = core_mask
        lo, hi, av = group
        complete = [r for r in measured.values() if all(c in r for c in group)]
        average = series(av)
        gaps = np.array([[number(r[av])-number(r[lo]), number(r[hi])-number(r[av])] for r in complete])
        chosen = gaps[rng.integers(0, len(gaps), n)]
        lower, upper = average - chosen[:, 0], average + chosen[:, 1]
        lower = np.maximum(lower, population(lo).min())
        upper = np.minimum(upper, population(hi).max())
        if lo == 18:
            lower = np.clip(lower, 0, 1); upper = np.clip(upper, 0, 1)
        auxiliary[lo], auxiliary[hi], auxiliary[av] = lower, upper, average
    wrist_mask = availability(rng, n, len(population(17))/len(measured), cfg['mask_persistence'])
    wrist = series(17)
    fall_mask = availability(rng, n, cfg['fall_asleep_probability'], cfg['mask_persistence'])
    fall = rng.triangular(*cfg['fall_asleep_minutes'], size=n)/60
    values, provenance = deepcopy(measured), {}
    for i, d in enumerate(dates):
        row = values.setdefault(d, {})
        def fill(c, value, category=MODEL):
            if c not in row:
                row[c] = value; provenance[d, c] = category
        if d not in measured:
            total, aw = float(asleep[i]), float(awake[i])
            inbed = total + aw
            start = bedtime[i] % 24
            # Quantize clock times/durations to milliseconds; identities remain within 1 ms.
            duration_seconds = round(inbed * 3600, 3)
            start_ms = int(round(start * 3.6e6)) % 86400000
            def clock(ms):
                return (datetime.min + timedelta(milliseconds=ms % 86400000)).time()
            fill(2, True); fill(3, clock(start_ms)); fill(4, clock(start_ms + round(duration_seconds*1000)))
            fill(6, timedelta(hours=total)); fill(7, timedelta(hours=aw)); fill(5, timedelta(hours=inbed))
            fill(11, int(wake_count[i])); fill(12, total/inbed)
            fill(24, MODEL)
            for group in groups:
                if masks[group][i]:
                    for c in group:
                        fill(c, float(auxiliary[c][i]))
            if wrist_mask[i]:
                fill(17, float(wrist[i]))
        # Fill stages on incomplete measured nights using the measured total as an exact constraint.
        missing = [c for c in (8, 9, 10) if c not in row]
        if missing:
            remaining = number(row[6]) - sum(number(row[c]) for c in (8, 9, 10) if c in row)
            if remaining < -1e-6:
                raise ValueError(f'Measured stage durations exceed total sleep on {d}')
            weights = np.array([shares[i, c-8] for c in missing]); weights /= weights.sum()
            upper = np.array([population(c).max()*1.15 for c in missing])
            allocated = bounded_allocation(max(0, remaining)*weights, max(0, remaining), upper)
            for c, hours in zip(missing, allocated):
                fill(c, timedelta(hours=float(hours)))
        if fall_mask[i]:
            fill(13, timedelta(hours=min(float(fall[i]), number(row[7]))), PRIOR)
    return values, provenance, {'measurement_rates': {headers[c]: len(population(c))/len(measured) for c in range(14,24)},
        'temporal_model': 'Conservative AR persistence is a configured testing prior, not fitted to 29 nights.',
        'auxiliary_availability': 'Shared group availability mask reflects observed joint missingness.',
        'stage_model': 'Empirical compositions with small jitter and exact remaining-duration allocation.'}


def womens_generate(dates, rng, cfg):
    rows, provenance, cycles = {}, {}, []
    lo, hi = cfg['cycle_bounds_days']
    d = dates[0] - timedelta(days=int(rng.integers(0, hi)))
    while d <= dates[-1]:
        length = int(np.clip(round(rng.normal(cfg['cycle_mean_days'], cfg['cycle_sd_days'])), lo, hi))
        bleeding = int(rng.integers(cfg['menstruation_bounds_days'][0], cfg['menstruation_bounds_days'][1]+1))
        cycles.append({'start': d.isoformat(), 'cycle_days': length, 'menstruation_days': bleeding})
        for offset in range(length):
            current = d + timedelta(days=offset)
            if dates[0] <= current <= dates[-1]:
                flow = 'None'
                if offset < bleeding:
                    flow = 'Light' if offset in (0, bleeding-1) else str(rng.choice(['Medium', 'Heavy'], p=[.7,.3]))
                rows[current] = {2: time(12), 3: offset==0, 4: flow, 5: PRIOR}
                for c in range(2,6):
                    provenance[current,c] = PRIOR
        d += timedelta(days=length)
    return rows, provenance, cycles


def preserve_xml(source, output, row_maps):
    """Restore raw measured cells: openpyxl otherwise rounds Excel durations to milliseconds."""
    with zipfile.ZipFile(source) as src, zipfile.ZipFile(output) as dst:
        shared = [''.join(si.itertext()) for si in ET.fromstring(src.read('xl/sharedStrings.xml')).findall('m:si', NS)] if 'xl/sharedStrings.xml' in src.namelist() else []
        def parts(z):
            relationships = {r.attrib['Id']:r.attrib['Target'] for r in ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
            result = {}
            for sh in ET.fromstring(z.read('xl/workbook.xml')).findall('m:sheets/m:sheet', NS):
                target = relationships[sh.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
                result[sh.attrib['name']] = target.lstrip('/') if target.startswith('/') else 'xl/'+target
            return result
        source_parts, output_parts = parts(src), parts(dst)
        replacements, checks = {}, []
        for name, source_part in source_parts.items():
            original = ET.fromstring(src.read(source_part))
            saved = ET.fromstring(dst.read(output_parts[name]))
            rows = {int(r.attrib['r']):r for r in saved.findall('m:sheetData/m:row', NS)}
            for r in original.findall('m:sheetData/m:row', NS):
                old_row = int(r.attrib['r']); new_row = row_maps.get(name, {}).get(old_row, old_row)
                if new_row not in rows:
                    continue
                target_row = rows[new_row]
                current = {c.attrib['r']:c for c in target_row}
                for cell in r:
                    v = cell.find('m:v', NS)
                    if v is None or v.text is None:
                        continue
                    if cell.attrib.get('t') == 's' and not shared[int(v.text)]:
                        continue
                    address = re.sub(r'\d+$', str(new_row), cell.attrib['r'])
                    replacement = deepcopy(cell); replacement.attrib['r'] = address
                    if address in current:
                        replacement.attrib['s'] = current[address].attrib.get('s','0')
                        target_row.remove(current[address])
                    if cell.attrib.get('t') == 's':
                        replacement.attrib['t'] = 'inlineStr'; replacement.remove(replacement.find('m:v', NS))
                        inline = ET.SubElement(replacement, f'{{{MAIN}}}is')
                        text = ET.SubElement(inline, f'{{{MAIN}}}t'); text.text = shared[int(v.text)]
                        text.attrib['{http://www.w3.org/XML/1998/namespace}space'] = 'preserve'
                    target_row.append(replacement)
                    checks.append((output_parts[name], address, replacement.attrib.get('t'),
                                   v.text if cell.attrib.get('t') != 's' else shared[int(v.text)]))
                def column(cell):
                    value = 0
                    for ch in re.match(r'[A-Z]+', cell.attrib['r'])[0]:
                        value = value*26+ord(ch)-64
                    return value
                target_row[:] = sorted(target_row, key=column)
            replacements[output_parts[name]] = ET.tostring(saved, encoding='utf-8', xml_declaration=True)
        with tempfile.NamedTemporaryFile(dir=output.parent, suffix='.xlsx', delete=False) as tmp:
            temp = Path(tmp.name)
        with zipfile.ZipFile(temp, 'w', zipfile.ZIP_DEFLATED) as patched:
            for info in dst.infolist():
                content = replacements.get(info.filename, dst.read(info.filename))
                # Normalize package timestamps so identical seeded runs also produce identical workbook bytes.
                if info.filename == 'docProps/core.xml':
                    core = ET.fromstring(content)
                    for node in core:
                        if node.tag.endswith(('}modified','}created')):
                            node.text = '2000-01-01T00:00:00Z'
                    content = ET.tostring(core, encoding='utf-8', xml_declaration=True)
                info.date_time = (2000,1,1,0,0,0)
                patched.writestr(info, content)
    temp.replace(output)
    with zipfile.ZipFile(output) as z:
        cached = {}
        for part, address, typ, expected in checks:
            if part not in cached:
                cached[part] = {c.attrib['r']:c for c in ET.fromstring(z.read(part)).findall('.//m:sheetData/m:row/m:c', NS)}
            cell = cached[part][address]
            actual = ''.join(cell.find('m:is',NS).itertext()) if typ == 'inlineStr' else cell.find('m:v',NS).text
            if actual != expected:
                raise AssertionError(f'Measured-cell preservation failed: {part}:{address}')
    return len(checks)


def distribution(values):
    if values and all(isinstance(v,(datetime,date)) for v in values):
        dates=sorted(str(day(v)) for v in values)
        return {'n':len(values),'categories':{'first_date':dates[0],'last_date':dates[-1]}}
    numbers = np.array([number(v) for v in values], float)
    numbers = numbers[np.isfinite(numbers)]
    if not len(numbers):
        return {'n':len(values), 'categories': dict(Counter(str(v) for v in values))}
    return {'n': len(numbers), 'min':float(numbers.min()), 'q05':float(np.quantile(numbers,.05)),
            'q25':float(np.quantile(numbers,.25)), 'median':float(np.median(numbers)),
            'q75':float(np.quantile(numbers,.75)), 'q95':float(np.quantile(numbers,.95)),
            'max':float(numbers.max()), 'mean':float(numbers.mean()), 'sd':float(numbers.std())}


def safe_correlation(pairs):
    if len(pairs) < 3:
        return None
    a = np.asarray(pairs, float)
    if min(a.std(axis=0)) == 0:
        return None
    return float(np.corrcoef(a.T)[0,1])


def diagnostics(sheet_name, headers, values, origins, output):
    columns = list(range(2,10)) if sheet_name=='Daily Metrics' else [5,6,7,8,9,10,11,12,16,17,20,23]
    fig, axes = plt.subplots(len(columns), 2, figsize=(15, 2.6*len(columns)), squeeze=False)
    for row, c in enumerate(columns):
        groups = {category:[] for category in (MEASURED,MODEL,PRIOR)}
        for d, record in sorted(values.items()):
            if c in record and np.isfinite(number(record[c])):
                groups[origins.get((d,c),MEASURED)].append((d,number(record[c])))
        label = headers[c] + (' (hours)' if sheet_name=='Sleep' and c in range(5,11) else '')
        combined=[x for group in groups.values() for _,x in group]
        bins=np.histogram_bin_edges(combined,bins=25) if combined else 25
        for category, color in ((MEASURED,'#1764ab'),(MODEL,'#e68619'),(PRIOR,'#7b4ca0')):
            observations = groups[category]
            if not observations:
                continue
            d,x = zip(*observations)
            if len(set(x))>1:
                axes[row,0].hist(x,bins=bins,density=True,alpha=.42,color=color,label=f'{category} (n={len(x)})')
            else:
                axes[row,0].axvline(x[0],color=color,label=f'{category} (n={len(x)})')
            # Points avoid falsely joining gaps in sparse measurements.
            axes[row,1].scatter(d,x,s=4 if category!=MEASURED else 9,color=color,alpha=.65,label=category)
        axes[row,0].set_title(label); axes[row,0].set_ylabel('Density'); axes[row,0].legend(fontsize=7)
        axes[row,1].set_title(label); axes[row,1].tick_params(axis='x',rotation=25)
        for axis in axes[row]:
            axis.grid(alpha=.2)
    fig.suptitle(f'{sheet_name}: measured versus synthetic (test data)',fontsize=15)
    fig.tight_layout(rect=(0,0,1,.99))
    stem = sheet_name.lower().replace(' ','_')
    fig.savefig(output/f'{stem}_diagnostics.png',dpi=140)
    fig.savefig(output/f'{stem}_diagnostics.pdf',metadata={'CreationDate':None,'ModDate':None})
    plt.close(fig)


def validate(output, original, generated, origins, all_headers, preserved, cycles, config, models, source_hash):
    report = {'source_sha256':source_hash, 'seed':config['seed'], 'measured_cells_verified_raw_xml':preserved,
              'models':models, 'variables':[], 'sleep_consistency':{}, 'cycles':cycles,
              'limitations':['Sleep distributions are based on 29 nights; temporal persistence is an explicit prior.',
              'Auxiliary availability rates are conditional on recorded nights, not overall historical sensor use.',
              'Womens Health is fictional and independent of all health variables.',
              'Original missing measurement schedules are retained; no FIT or performance inputs are read.',
              'Historical stationarity is a visualization assumption, not reconstructed history.']}
    flat, time_stats, relationship_rows = [], [], []
    for name, values in generated.items():
        headers = all_headers[name]
        for c,label in headers.items():
            counts = {cat:[] for cat in (MEASURED,MODEL,PRIOR)}
            for d,r in values.items():
                if c in r and present(r[c]):
                    counts[origins[name].get((d,c), MEASURED)].append(r[c])
            entry = {'sheet':name,'column':c,'variable':label,'records':len(values),
                     'missing':sum(c not in r or not present(r[c]) for r in values.values()),
                     'source_records':len(original[name]),
                     'source_missing':sum(c not in r or not present(r[c]) for r in original[name].values()),
                     'unit':'hours' if name=='Sleep' and c in range(5,11) or name=='Sleep' and c==13 else 'Excel native',
                     'groups':{cat:distribution(v) for cat,v in counts.items()}}
            report['variables'].append(entry)
            for cat, vals in counts.items():
                stats = distribution(vals)
                flat.append({'sheet':name,'column':c,'variable':label,'provenance':cat,
                             'records':len(values),'missing':entry['missing'],'unit':entry['unit'],
                             'source_records':entry['source_records'],'source_missing':entry['source_missing'],
                             **{k:v for k,v in stats.items() if k!='categories'},
                             'categories':json.dumps(stats.get('categories',{}),sort_keys=True)})
                pairs=[]
                for d,r in values.items():
                    next_day = d+timedelta(days=1)
                    if c in r and next_day in values and c in values[next_day] and origins[name].get((d,c), MEASURED)==cat and origins[name].get((next_day,c),MEASURED)==cat:
                        a,b=number(r[c]),number(values[next_day][c])
                        if np.isfinite(a) and np.isfinite(b):pairs.append((a,b))
                time_stats.append({'sheet':name,'variable':label,'provenance':cat,'consecutive_day_pairs':len(pairs),'lag1_correlation':safe_correlation(pairs)})
        if name in ('Daily Metrics','Sleep'):
            cs = range(2,10) if name=='Daily Metrics' else [5,6,7,8,9,10,11,12,16,17,20,23]
            for i,c in enumerate(cs):
                for b in list(cs)[i+1:]:
                    for cat in (MEASURED,MODEL):
                        pairs=[(number(r[c]),number(r[b])) for d,r in values.items() if c in r and b in r and origins[name].get((d,c),MEASURED)==cat and origins[name].get((d,b),MEASURED)==cat and np.isfinite(number(r[c])) and np.isfinite(number(r[b]))]
                        relationship_rows.append({'sheet':name,'variable_a':headers[c],'variable_b':headers[b],'provenance':cat,'pairs':len(pairs),'correlation':safe_correlation(pairs)})
    failures=[]; clock_exceptions=[]; sleep=generated['Sleep']
    for d,r in sleep.items():
        duration_error = abs(sum(number(r[c]) for c in (8,9,10))-number(r[6]))*3600
        inbed_error = abs(number(r[5])-number(r[6])-number(r[7]))*3600
        efficiency_error = abs(number(r[12])-number(r[6])/number(r[5]))
        if max(duration_error,inbed_error)>0.005 or efficiency_error>1e-6:
            failures.append(str(d))
        for low,av,high in ((14,16,15),(18,20,19),(21,23,22)):
            if all(c in r for c in (low,av,high)) and not number(r[low]) <= number(r[av]) <= number(r[high]):
                failures.append(f'{d} summary ordering {low}/{av}/{high}')
        clock_error = abs((number(r[4])-number(r[3]))%24-number(r[5]))*3600
        if clock_error>1:
            clock_exceptions.append({'date':str(d),'seconds':clock_error,'original_measured':d in original['Sleep']})
    report['sleep_consistency']={'failures':failures,'clock_exceptions':clock_exceptions,'tolerance_seconds':.005}
    if failures or any(not x['original_measured'] for x in clock_exceptions):
        raise AssertionError(f'Sleep validation failed: {failures}, {clock_exceptions}')
    for name in ('Daily Metrics','Sleep','Womens Health'):
        if len(generated[name])!=len(generated['Daily Metrics']):
            raise AssertionError(f'Date grid mismatch: {name}')
    report['temporal_diagnostics']=time_stats
    report['cycle_summary']={'cycle_length':distribution([c['cycle_days'] for c in cycles]),
        'menstruation_duration':distribution([c['menstruation_days'] for c in cycles]),
        'boundary_policy':'Cycles are generated before and beyond the range; boundary cycles may be partially visible.'}
    pd.DataFrame(flat).to_csv(output/'variable_validation.csv',index=False)
    pd.DataFrame(time_stats).to_csv(output/'temporal_validation.csv',index=False)
    pd.DataFrame(relationship_rows).to_csv(output/'relationship_validation.csv',index=False)
    (output/'validation.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    lines=['# Health synthetic-data validation', '',
        f"Seed: {config['seed']}. Original nonempty cells verified at raw XML precision: {preserved}.",
        '', 'Counts below exclude date/time, main flags, and data-source text.', '',
        '| Sheet | Variable | Measured | Synthetic model | Synthetic prior | Missing |',
        '| --- | --- | ---: | ---: | ---: | ---: |']
    for entry in report['variables']:
        if entry['sheet'] in ('Daily Metrics','Sleep','Womens Health') and entry['column'] != 1 and not (entry['sheet']=='Sleep' and entry['column']==2) and not (entry['sheet']=='Womens Health' and entry['column']==2) and entry['variable']!='Data Source':
            g=entry['groups']
            lines.append(f"| {entry['sheet']} | {entry['variable']} | {g[MEASURED]['n']} | {g[MODEL]['n']} | {g[PRIOR]['n']} | {entry['missing']} |")
    lines += ['', 'Sleep checks: no duration, efficiency, stage, or minimum/average/maximum ordering failures.',
              'Original March 8, 2026 clock-window discrepancy is preserved and reported separately.',
              '', 'See variable_validation.csv for ranges, quantiles, missingness and counts; temporal_validation.csv for consecutive-day autocorrelation; relationship_validation.csv for within-tab pairwise comparisons.',
              '', 'Diagnostic PNG and PDF files compare measured and synthetic distributions and full-range time series.',
              '', '## Modeling limits', ''] + [f'- {x}' for x in report['limitations']]
    (output/'validation.md').write_text('\n'.join(lines)+'\n')
    return report


def validate_config(config):
    for key in ('mask_persistence','vo2_persistence'):
        if not 0<=config['daily'][key]<1:raise ValueError(f'daily.{key} must be in [0,1)')
    if not 0<=config['daily']['correlation_shrinkage']<=1:raise ValueError('Invalid correlation shrinkage')
    for key in ('mask_persistence','persistence_prior','stage_persistence_prior'):
        if not 0<=config['sleep'][key]<1:raise ValueError(f'sleep.{key} must be in [0,1)')
    if not 0<=config['sleep']['fall_asleep_probability']<=1:raise ValueError('Invalid Fall Asleep probability')
    left,mode,right=config['sleep']['fall_asleep_minutes']
    if not 0<=left<=mode<=right or left==right:raise ValueError('Invalid triangular Fall Asleep prior')
    cycle_lo,cycle_hi=config['womens_health']['cycle_bounds_days']
    bleeding_lo,bleeding_hi=config['womens_health']['menstruation_bounds_days']
    if not 1<=bleeding_lo<=bleeding_hi<cycle_lo<=cycle_hi:raise ValueError('Invalid cycle/menstruation bounds')
    if config['womens_health']['cycle_sd_days']<0:raise ValueError('Cycle SD cannot be negative')


def generate(source, outdir, config, plots=True):
    validate_config(config)
    source=source.resolve();outdir=outdir.resolve();outdir.mkdir(parents=True,exist_ok=True)
    target=outdir/'Health Metrics_synthetic.xlsx'
    if source==target:
        raise ValueError('Output must not overwrite the source workbook')
    source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
    workbook=openpyxl.load_workbook(source)
    all_headers, original, original_row_numbers = {}, {}, {}
    for sheet in workbook:
        all_headers[sheet.title],original[sheet.title],original_row_numbers[sheet.title]=sheet_data(sheet)
    latest=max(d for rows in original.values() for d in rows)
    start=date.fromisoformat(config['start_date'])
    if start>min(d for rows in original.values() for d in rows):
        raise ValueError('Start date excludes measured observations')
    dates=[start+timedelta(days=i) for i in range((latest-start).days+1)]
    streams=np.random.SeedSequence(config['seed']).spawn(3)
    generated,origins=deepcopy(original),{name:{} for name in original}
    generated['Daily Metrics'],origins['Daily Metrics'],daily_model=daily_generate(all_headers['Daily Metrics'],original['Daily Metrics'],dates,np.random.default_rng(streams[0]),config['daily'])
    generated['Sleep'],origins['Sleep'],sleep_model=sleep_generate(all_headers['Sleep'],original['Sleep'],dates,np.random.default_rng(streams[1]),config['sleep'])
    if original['Womens Health']:
        raise ValueError('Womens Health contains measured data: refusing to replace it with fictional records')
    generated['Womens Health'],origins['Womens Health'],cycles=womens_generate(dates,np.random.default_rng(streams[2]),config['womens_health'])
    row_maps={}; provenance=[]
    for name in original:
        sheet=workbook[name]
        if name in ('Daily Metrics','Sleep','Womens Health'):
            original_styles={(d,c):copy(sheet.cell(r,c)._style) for d,r in original_row_numbers[name].items() for c in original[name][d]}
            templates={}
            for c in all_headers[name]:
                candidates=[sheet.cell(r,c) for r in original_row_numbers[name].values() if present(sheet.cell(r,c).value)]
                templates[c]=copy(candidates[0]._style) if candidates else copy(workbook['Daily Metrics']['B2']._style)
            # Unsupported empty duration field gets a proper duration format when enabled.
            if name=='Womens Health':
                for c in (3,4,5):templates[c]=copy(workbook['Sleep']['X2']._style)
            if name=='Womens Health':
                templates[1]=copy(workbook['Daily Metrics']['A2']._style)
                templates[2]=copy(workbook['Sleep']['C2']._style)
            sheet.delete_rows(2,sheet.max_row)
            row_maps[name]={1:1}
            for i,d in enumerate(reversed(dates),2):
                row=generated[name][d]
                if 1 not in row:
                    row[1]=datetime.combine(d,time())
                    origins[name][d,1]=PRIOR if name=='Womens Health' else MODEL
                if d in original_row_numbers[name]:
                    row_maps[name][original_row_numbers[name][d]]=i
                for c,value in row.items():
                    cell=sheet.cell(i,c,value);cell._style=copy(original_styles.get((d,c),templates.get(c)))
                    if name=='Sleep' and c in (*range(5,11),13) and (d,c) not in original_styles:
                        cell.number_format='[h]"h":mm"m"'
                    if name=='Sleep' and c in (3,4) and (d,c) not in original_styles:
                        cell.number_format='hh:mm'
            sheet.freeze_panes='A2'
        # Provenance also covers untouched tabs, source text, and dates.
        for i,row in enumerate(sheet.iter_rows(min_row=2),2):
            if not present(row[0].value):continue
            d=day(row[0].value)
            for cell in row:
                if present(cell.value):
                    category=origins[name].get((d,cell.column),MEASURED)
                    provenance.append([name,i,str(d),cell.coordinate,cell.column,all_headers[name].get(cell.column,''),category])
    prov=workbook.create_sheet('Provenance')
    prov.append(['Sheet','Output Row','Date','Cell','Column','Variable','Provenance'])
    for row in provenance:prov.append(row)
    prov.freeze_panes='A2';prov.auto_filter.ref=prov.dimensions
    record_sheet=workbook.create_sheet('Record Provenance')
    record_sheet.append(['Sheet','Date','Provenance Categories','Measured Values','Synthetic Model Values','Synthetic Prior Values'])
    for name,rows in generated.items():
        for d,r in sorted(rows.items(),reverse=True):
            counts=Counter(origins[name].get((d,c),MEASURED) for c,v in r.items() if present(v))
            record_sheet.append([name,str(d),' + '.join(sorted(counts)),counts[MEASURED],counts[MODEL],counts[PRIOR]])
    info=workbook.create_sheet('Generation Info')
    versions={package:importlib.metadata.version(package) for package in ('numpy','pandas','scipy','openpyxl','matplotlib')}
    metadata={'source_sha256':source_hash,'start':str(start),'end':str(latest),'days':len(dates),'config':config,'versions':versions,
              'purpose':'Visualization software testing; synthetic history is not physiological inference.',
              'womens_health_encoding':{'Start of Cycle':'boolean','Menstruation':['None','Light','Medium','Heavy'],'Time':'12:00 synthetic event timestamp'},
              'missingness':'Original sparse measurement schedules are retained. New daily rows use observed rates; sleep auxiliary rates are conditional on observed nights.'}
    info.append(['Key','Value'])
    for k,v in metadata.items():info.append([k,json.dumps(v,ensure_ascii=False,sort_keys=True)])
    workbook.save(target)
    preserved=preserve_xml(source,target,row_maps)
    report=validate(outdir,original,generated,origins,all_headers,preserved,cycles,config,{'daily':daily_model,'sleep':sleep_model},source_hash)
    if hashlib.sha256(source.read_bytes()).hexdigest()!=source_hash:
        raise AssertionError('Source workbook changed')
    # Reopen the actual output and validate its serialized durations and ordering too.
    reloaded=openpyxl.load_workbook(target,read_only=True)
    for name in ('Daily Metrics','Sleep','Womens Health'):
        if reloaded[name].max_row!=len(dates)+1:raise AssertionError('Serialized row count mismatch')
    reloaded.close()
    (outdir/'run_metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
    (outdir/'config_used.json').write_text(json.dumps(config,indent=2)+'\n')
    pd.DataFrame(provenance,columns=['sheet','output_row','date','cell','column','variable','provenance']).to_csv(outdir/'provenance.csv',index=False)
    if plots:
        for name in ('Daily Metrics','Sleep'):
            diagnostics(name,all_headers[name],generated[name],origins[name],outdir)
    print(json.dumps({'output':str(target),'days':len(dates),'measured_cells_verified':preserved,'sleep_failures':report['sleep_consistency']['failures']},indent=2))
    return generated,origins,report


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input',type=Path,default=BASE.parent/'Health Metrics_v6.xlsx')
    parser.add_argument('--output-dir',type=Path,default=BASE.parent/'health_synthetic_results')
    parser.add_argument('--config',type=Path,default=BASE/'config.json')
    parser.add_argument('--seed',type=int,help='Override configured random seed')
    parser.add_argument('--no-plots',action='store_true')
    args=parser.parse_args();config=json.loads(args.config.read_text())
    if args.seed is not None:config['seed']=args.seed
    generate(args.input,args.output_dir,config,not args.no_plots)


if __name__=='__main__':
    main()
