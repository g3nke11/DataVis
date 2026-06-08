/**
 * Adaptive row filters for graph columns (numeric ranges, category picks, dates).
 */

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
  return Number.isNaN(d.getTime()) ? null : d;
}

export function inferColumnKind(rows, colIdx) {
  const nonBlank = rows.map((r) => r[colIdx] ?? '').filter((v) => !isBlank(v));
  if (!nonBlank.length) return 'empty';

  const numericVals = nonBlank.map(parseNumber).filter((n) => n != null);
  if (numericVals.length / nonBlank.length >= 0.8) return 'numeric';

  const dateVals = nonBlank.map(parseDateValue).filter((d) => d != null);
  if (dateVals.length / nonBlank.length >= 0.8) return 'date';

  return 'category';
}

export function getNumericBounds(rows, colIdx) {
  const vals = rows.map((r) => parseNumber(r[colIdx])).filter((n) => n != null);
  if (!vals.length) return { min: 0, max: 1 };
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

export function getDateBounds(rows, colIdx) {
  const vals = rows.map((r) => parseDateValue(r[colIdx])).filter((d) => d != null);
  if (!vals.length) return { min: '', max: '' };
  const times = vals.map((d) => d.getTime());
  return {
    min: new Date(Math.min(...times)).toISOString().slice(0, 10),
    max: new Date(Math.max(...times)).toISOString().slice(0, 10),
  };
}

export function getUniqueValues(rows, colIdx) {
  const seen = new Map();
  rows.forEach((row) => {
    const raw = row[colIdx] ?? '';
    const key = isBlank(raw) ? '(blank)' : String(raw).trim();
    seen.set(key, (seen.get(key) ?? 0) + 1);
  });
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([value, count]) => ({ value, count }));
}

/**
 * Columns used by the current chart that can be filtered.
 */
export function getFilterableColumns({ type, labelIdx, yIdx, valueCols, colorIdx, table }) {
  const entries = new Map();

  const add = (colIdx, role) => {
    if (colIdx == null || colIdx === '' || Number.isNaN(colIdx)) return;
    const idx = Number(colIdx);
    const prev = entries.get(idx) ?? new Set();
    prev.add(role);
    entries.set(idx, prev);
  };

  switch (type) {
    case 'scatter':
      add(labelIdx, 'axis');
      if (valueCols?.[0]) add(valueCols[0].colIdx, 'axis');
      add(colorIdx, 'category');
      break;
    case 'histogram':
      if (valueCols?.[0]) add(valueCols[0].colIdx, 'value');
      add(colorIdx, 'category');
      break;
    case 'pie':
      add(labelIdx, 'category');
      if (valueCols?.[0]) add(valueCols[0].colIdx, 'value');
      add(colorIdx, 'category');
      break;
    case 'heatmap':
      add(labelIdx, 'category');
      add(yIdx, 'category');
      if (valueCols?.[0]) add(valueCols[0].colIdx, 'value');
      break;
    case 'line':
    case 'bar':
    default:
      add(labelIdx, 'category');
      valueCols?.forEach((v) => add(v.colIdx, 'value'));
      add(colorIdx, 'category');
      break;
  }

  return [...entries.entries()].map(([colIdx, roles]) => ({
    colIdx,
    header: table.headers[colIdx] ?? `Column ${colIdx}`,
    roles: [...roles],
  }));
}

export function describeFilterKind(kind, roles) {
  if (kind === 'numeric') return 'numeric range';
  if (kind === 'date') return 'date range';
  return 'categories';
}

/**
 * @param {string[][]} rows
 * @param {Array<object>} filterDefs from getFilterableColumns + kind
 * @param {Map<number, object>} state colIdx -> { kind, min, max, selected:Set }
 */
export function applyRowFilters(rows, filterDefs, state) {
  if (!filterDefs.length || !state.size) return rows;

  return rows.filter((row) => {
    for (const def of filterDefs) {
      const s = state.get(def.colIdx);
      if (!s) continue;
      const raw = row[def.colIdx] ?? '';

      if (s.kind === 'numeric') {
        const n = parseNumber(raw);
        if (n == null) return false;
        if (n < s.min || n > s.max) return false;
      } else if (s.kind === 'date') {
        const d = parseDateValue(raw);
        if (!d) return false;
        const t = d.getTime();
        if (t < s.minTime || t > s.maxTime) return false;
      } else if (s.kind === 'category') {
        const key = isBlank(raw) ? '(blank)' : String(raw).trim();
        if (!s.selected.has(key)) return false;
      }
    }
    return true;
  });
}

export function defaultFilterState(rows, filterDefs) {
  const state = new Map();
  filterDefs.forEach((def) => {
    const kind = inferColumnKind(rows, def.colIdx);
    if (kind === 'numeric') {
      const { min, max } = getNumericBounds(rows, def.colIdx);
      state.set(def.colIdx, { kind: 'numeric', min, max });
    } else if (kind === 'date') {
      const { min, max } = getDateBounds(rows, def.colIdx);
      const minTime = min ? Date.parse(min) : -Infinity;
      const maxTime = max ? Date.parse(`${max}T23:59:59`) : Infinity;
      state.set(def.colIdx, { kind: 'date', min, max, minTime, maxTime });
    } else {
      const selected = new Set(getUniqueValues(rows, def.colIdx).map((v) => v.value));
      state.set(def.colIdx, { kind: 'category', selected });
    }
  });
  return state;
}
