/**
 * Serialize / deserialize graph builder state and build chart specs from saved config.
 */

import {
  getFilterableColumns,
  inferColumnKind,
  defaultFilterState,
  applyRowFilters,
} from './graph-filters.js';
import { MAX_ROWS } from './chart-renderers.js';

export function headerIndex(headers, name) {
  if (name == null || name === '') return null;
  const idx = headers.indexOf(name);
  return idx >= 0 ? idx : null;
}

export function buildGraphConfig({
  headers,
  labelIdx,
  yIdx,
  colorIdx,
  valueCols,
  filterDefs,
  filterState,
}) {
  const nameAt = (idx) => (idx != null && idx !== '' && headers[idx] != null ? headers[idx] : null);

  const filters = [];
  filterDefs.forEach((def) => {
    const state = filterState.get(def.colIdx);
    if (!state) return;
    if (state.kind === 'numeric') {
      filters.push({ column: def.header, kind: 'numeric', min: state.min, max: state.max });
    } else if (state.kind === 'date') {
      filters.push({ column: def.header, kind: 'date', min: state.min, max: state.max });
    } else if (state.kind === 'category') {
      filters.push({ column: def.header, kind: 'category', selected: [...state.selected] });
    }
  });

  return {
    labelColumn: nameAt(labelIdx),
    yColumn: nameAt(yIdx),
    colorColumn: colorIdx != null && colorIdx !== '' ? nameAt(colorIdx) : null,
    valueColumns: valueCols.map((v) => v.header),
    filters,
  };
}

export function mergeFilterStateFromConfig(rows, filterDefs, config, baseState) {
  const state = new Map(baseState);
  const savedByColumn = new Map((config?.filters ?? []).map((f) => [f.column, f]));

  filterDefs.forEach((def) => {
    const saved = savedByColumn.get(def.header);
    const kind = inferColumnKind(rows, def.colIdx);
    if (!saved || saved.kind !== kind) return;

    if (kind === 'numeric') {
      state.set(def.colIdx, { kind, min: saved.min, max: saved.max });
    } else if (kind === 'date') {
      state.set(def.colIdx, {
        kind,
        min: saved.min,
        max: saved.max,
        minTime: saved.min ? Date.parse(saved.min) : -Infinity,
        maxTime: saved.max ? Date.parse(`${saved.max}T23:59:59`) : Infinity,
      });
    } else if (kind === 'category') {
      state.set(def.colIdx, { kind: 'category', selected: new Set(saved.selected ?? []) });
    }
  });

  return state;
}

export function resolveConfigSelection(table, chartType, config) {
  const { headers } = table;
  const labelIdx = headerIndex(headers, config.labelColumn);
  const yIdx = headerIndex(headers, config.yColumn);
  const colorIdx = config.colorColumn ? headerIndex(headers, config.colorColumn) : null;

  const valueCols = (config.valueColumns ?? [])
    .map((header) => {
      const colIdx = headerIndex(headers, header);
      return colIdx == null ? null : { colIdx, header };
    })
    .filter(Boolean);

  const errors = [];
  if (chartType !== 'histogram' && config.labelColumn && labelIdx == null) {
    errors.push(`Label column "${config.labelColumn}" not found.`);
  }
  if (chartType === 'heatmap' && config.yColumn && yIdx == null) {
    errors.push(`Y column "${config.yColumn}" not found.`);
  }
  if (!valueCols.length) {
    errors.push('Saved value column(s) not found in dataset.');
  }
  if (config.colorColumn && colorIdx == null) {
    errors.push(`Color column "${config.colorColumn}" not found.`);
  }

  return {
    labelIdx: labelIdx ?? 0,
    yIdx: yIdx ?? 0,
    colorIdx,
    valueCols,
    errors,
  };
}

export function buildChartSpec(table, chartType, config) {
  const resolved = resolveConfigSelection(table, chartType, config);
  if (resolved.errors.length) {
    return { error: resolved.errors.join(' ') };
  }

  const { labelIdx, yIdx, colorIdx, valueCols } = resolved;
  const selection = {
    type: chartType,
    labelIdx,
    yIdx,
    colorIdx,
    valueCols,
    table,
  };

  const filterDefs = getFilterableColumns(selection);
  const baseFilters = defaultFilterState(table.rows, filterDefs);
  const filterState = mergeFilterStateFromConfig(table.rows, filterDefs, config, baseFilters);
  const filtered = applyRowFilters(table.rows, filterDefs, filterState);
  const rows = filtered.slice(0, MAX_ROWS);

  const base = {
    type: chartType,
    table,
    rows,
    colorIdx,
    filterMeta: {
      totalRows: table.rows.length,
      filteredCount: filtered.length,
      capped: filtered.length > MAX_ROWS,
    },
  };

  switch (chartType) {
    case 'scatter':
      if (!valueCols.length) return { error: 'Select a Y column.' };
      return { ...base, xIdx: labelIdx, yIdx: valueCols[0].colIdx };
    case 'histogram':
      if (!valueCols.length) return { error: 'Select a numeric column.' };
      return { ...base, valueCol: valueCols[0] };
    case 'pie':
      if (!valueCols.length) return { error: 'Select a value column.' };
      return { ...base, labelIdx, valueCol: valueCols[0] };
    case 'heatmap':
      if (!valueCols.length) return { error: 'Select a value column.' };
      return { ...base, xIdx: labelIdx, yIdx, valueCol: valueCols[0] };
    case 'line':
    case 'bar':
    default:
      if (!valueCols.length) return { error: 'Select at least one numeric column.' };
      return { ...base, labelIdx, valueCols };
  }
}
