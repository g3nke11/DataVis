/**
 * Per-column summary stats for tabular datasets.
 * Returns N/A for metrics that do not apply to a column's inferred type.
 */

export const NA = 'N/A';

function isBlank(val) {
  return val == null || String(val).trim() === '';
}

function parseNumber(val) {
  const s = String(val).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseDateValue(val) {
  const s = String(val).trim();
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    if (n >= 1900 && n <= 2100 && Number.isInteger(n)) return new Date(n, 0, 1);
    return null;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function median(sorted) {
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function modeOf(values) {
  if (!values.length) return null;
  const counts = new Map();
  let best = values[0];
  let bestCount = 0;
  for (const v of values) {
    const key = String(v);
    const c = (counts.get(key) ?? 0) + 1;
    counts.set(key, c);
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return { value: best, count: bestCount };
}

function fmtNumber(n, digits = 4) {
  if (n == null || Number.isNaN(n)) return NA;
  const rounded = Number(n.toPrecision(digits));
  return String(rounded);
}

function fmtDate(d) {
  if (!d || Number.isNaN(d.getTime())) return NA;
  return d.toISOString().slice(0, 10);
}

/**
 * @param {string[]} headers
 * @param {string[][]} rows
 * @returns {Array<{
 *   column: string,
 *   kind: 'numeric' | 'date' | 'text' | 'empty',
 *   metrics: Record<string, string>
 * }>}
 */
export function computeColumnSummaries(headers, rows) {
  return headers.map((column, colIdx) => {
    const raw = rows.map((r) => r[colIdx] ?? '');
    const nonBlank = raw.filter((v) => !isBlank(v));
    const total = raw.length;

    if (!nonBlank.length) {
      return {
        column,
        kind: 'empty',
        metrics: buildMetrics('empty', { total, nonBlank: 0 }),
      };
    }

    const numericVals = nonBlank.map(parseNumber).filter((n) => n != null);
    const numericRatio = numericVals.length / nonBlank.length;

    if (numericRatio >= 0.8) {
      const sorted = [...numericVals].sort((a, b) => a - b);
      const sum = numericVals.reduce((a, b) => a + b, 0);
      const mean = sum / numericVals.length;
      const sq = numericVals.reduce((a, v) => a + (v - mean) ** 2, 0);
      const variance = numericVals.length > 1 ? sq / (numericVals.length - 1) : 0;
      const mode = modeOf(nonBlank);
      return {
        column,
        kind: 'numeric',
        metrics: buildMetrics('numeric', {
          total,
          nonBlank: nonBlank.length,
          mean,
          median: median(sorted),
          min: sorted[0],
          max: sorted[sorted.length - 1],
          sum,
          stdDev: Math.sqrt(variance),
          mode: mode.value,
          modeCount: mode.count,
          unique: new Set(nonBlank.map(String)).size,
        }),
      };
    }

    const dateVals = nonBlank.map(parseDateValue).filter((d) => d != null);
    const dateRatio = dateVals.length / nonBlank.length;

    if (dateRatio >= 0.8) {
      const sorted = [...dateVals].sort((a, b) => a - b);
      const mode = modeOf(nonBlank);
      return {
        column,
        kind: 'date',
        metrics: buildMetrics('date', {
          total,
          nonBlank: nonBlank.length,
          earliest: sorted[0],
          latest: sorted[sorted.length - 1],
          mode: mode.value,
          modeCount: mode.count,
          unique: new Set(nonBlank.map(String)).size,
        }),
      };
    }

    const mode = modeOf(nonBlank);
    return {
      column,
      kind: 'text',
      metrics: buildMetrics('text', {
        total,
        nonBlank: nonBlank.length,
        mode: mode.value,
        modeCount: mode.count,
        unique: new Set(nonBlank.map(String)).size,
      }),
    };
  });
}

function buildMetrics(kind, data) {
  const m = {
    Type: kind === 'empty' ? 'empty' : kind,
    Rows: String(data.total ?? 0),
    'Non-empty': String(data.nonBlank ?? 0),
    Mean: NA,
    Median: NA,
    'Std dev': NA,
    Sum: NA,
    Min: NA,
    Max: NA,
    Earliest: NA,
    Latest: NA,
    'Most common': NA,
    'Mode count': NA,
    'Unique values': NA,
  };

  if (kind === 'empty') {
    return m;
  }

  m['Unique values'] = String(data.unique ?? NA);

  if (kind === 'numeric') {
    m.Mean = fmtNumber(data.mean);
    m.Median = fmtNumber(data.median);
    m['Std dev'] = fmtNumber(data.stdDev);
    m.Sum = fmtNumber(data.sum);
    m.Min = fmtNumber(data.min);
    m.Max = fmtNumber(data.max);
    m['Most common'] = String(data.mode);
    m['Mode count'] = String(data.modeCount);
    return m;
  }

  if (kind === 'date') {
    m.Earliest = fmtDate(data.earliest);
    m.Latest = fmtDate(data.latest);
    m['Most common'] = String(data.mode);
    m['Mode count'] = String(data.modeCount);
    return m;
  }

  m['Most common'] = String(data.mode);
  m['Mode count'] = String(data.modeCount);
  return m;
}

/** Metric keys shown in the summary table (row order). */
export const SUMMARY_METRIC_KEYS = [
  'Type',
  'Rows',
  'Non-empty',
  'Mean',
  'Median',
  'Std dev',
  'Sum',
  'Min',
  'Max',
  'Earliest',
  'Latest',
  'Most common',
  'Mode count',
  'Unique values',
];
