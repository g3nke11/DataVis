import { getActiveDataset, setActiveDatasetId } from './dataset-store.js';
import { datasetToTable, columnNumericScores } from './storage.js';
import { renderChart, MAX_ROWS, getChartTheme } from './chart-renderers.js';
import {
  getFilterableColumns,
  inferColumnKind,
  describeFilterKind,
  getNumericBounds,
  getDateBounds,
  getUniqueValues,
  applyRowFilters,
  defaultFilterState,
} from './graph-filters.js';
import {
  buildGraphConfig,
  mergeFilterStateFromConfig,
  headerIndex,
} from './graph-config.js';
import { saveSavedGraph, getSavedGraph, canSaveGraphs } from './saved-graph-store.js';
import { downloadCanvasPng, sanitizeFilename } from './download-utils.js';

export const CHART_TYPES = {
  bar: {
    label: 'Grouped bar',
    hint: 'Compare numeric columns across category labels. Optional color column tints each bar.',
    labelTitle: 'Label column (categories)',
    values: 'multi',
    needsLabel: true,
    needsY: false,
    color: true,
  },
  line: {
    label: 'Line',
    hint: 'Plot numeric columns across ordered labels. Points can be colored by a third column.',
    labelTitle: 'X / label column',
    values: 'multi',
    needsLabel: true,
    needsY: false,
    color: true,
  },
  scatter: {
    label: 'Scatter',
    hint: 'Plot two numeric columns (X and Y). Color points by a category column.',
    labelTitle: 'X column (numeric)',
    values: 'single',
    valuesTitle: 'Y column (numeric)',
    needsLabel: true,
    needsY: false,
    color: true,
    numericLabel: true,
  },
  histogram: {
    label: 'Histogram',
    hint: 'Distribution of one numeric column. Optionally split bars by a color column.',
    labelTitle: 'Column (not used)',
    values: 'single',
    valuesTitle: 'Value column (numeric)',
    needsLabel: false,
    needsY: false,
    color: true,
  },
  pie: {
    label: 'Pie',
    hint: 'Slice sizes from one numeric column, grouped by label. Colors follow label or color column.',
    labelTitle: 'Label column (slice names)',
    values: 'single',
    valuesTitle: 'Value column (numeric)',
    needsLabel: true,
    needsY: false,
    color: true,
  },
  heatmap: {
    label: 'Heatmap',
    hint: 'Grid of X × Y categories; cell intensity is the sum of a numeric value column.',
    labelTitle: 'X column (categories)',
    values: 'single',
    valuesTitle: 'Value column (numeric)',
    needsLabel: true,
    needsY: true,
    yTitle: 'Y column (categories)',
    color: false,
  },
};

const emptyState = document.getElementById('graph-empty');
const chartPanel = document.getElementById('chart-panel');
const datasetTitle = document.getElementById('graph-dataset-name');
const chartTypeSelect = document.getElementById('chart-type');
const labelField = document.getElementById('field-label');
const labelTitle = document.getElementById('label-column-title');
const labelSelect = document.getElementById('label-column');
const yField = document.getElementById('field-y-axis');
const yTitle = document.getElementById('y-column-title');
const ySelect = document.getElementById('y-column');
const valueField = document.getElementById('field-values');
const valueTitle = document.getElementById('value-columns-title');
const valueList = document.getElementById('value-columns');
const colorField = document.getElementById('field-color');
const colorSelect = document.getElementById('color-column');
const chartHint = document.getElementById('chart-hint');
const rangeControls = document.getElementById('range-controls');
const rangeHint = document.getElementById('range-hint');
const resetFiltersBtn = document.getElementById('reset-filters');
const canvas = document.getElementById('chart-canvas');
const chartMeta = document.getElementById('chart-meta');
const renderBtn = document.getElementById('render-chart');
const downloadChartBtn = document.getElementById('download-chart-png');
const saveGraphField = document.getElementById('field-save-graph');
const saveGraphNameInput = document.getElementById('save-graph-name');
const saveGraphBtn = document.getElementById('save-graph-btn');
const saveGraphMsg = document.getElementById('save-graph-msg');

let table = { headers: [], rows: [] };
let numericCols = [];
let filterDefs = [];
let filterState = new Map();
let filtersInitialized = false;
let activeDatasetName = '';
let activeDatasetId = '';
let activeDatasetSource = 'local';
let chartDownloadReady = false;
let loadedGraphName = '';

function setChartDownloadReady(ready) {
  chartDownloadReady = ready;
  if (downloadChartBtn) downloadChartBtn.disabled = !ready;
}

async function init() {
  const graphParam = new URLSearchParams(window.location.search).get('graph');
  let pendingGraph = graphParam ? await getSavedGraph(graphParam) : null;

  if (pendingGraph) {
    setActiveDatasetId(pendingGraph.datasetId);
  }

  let dataset = await getActiveDataset();
  if (!dataset) {
    if (emptyState) emptyState.hidden = false;
    if (chartPanel) chartPanel.hidden = true;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  if (chartPanel) chartPanel.hidden = false;
  if (datasetTitle) {
    datasetTitle.textContent = pendingGraph
      ? `${dataset.name} — ${pendingGraph.name}`
      : dataset.name;
  }
  activeDatasetName = dataset.name;
  activeDatasetId = dataset.id;
  activeDatasetSource = dataset.source ?? 'local';
  loadedGraphName = pendingGraph?.name ?? '';

  table = datasetToTable(dataset);
  numericCols = columnNumericScores(table.headers, table.rows).filter((c) => c.numericRatio >= 0.5);

  populateChartTypeSelect();
  populateColumnDropdowns();
  applyChartTypeUI();
  bindEvents();
  await refreshSaveGraphUI();

  if (pendingGraph) {
    applySavedGraphConfig(pendingGraph.chartType, pendingGraph.config);
    if (saveGraphNameInput && !saveGraphNameInput.value) {
      saveGraphNameInput.value = pendingGraph.name;
    }
  }

  drawChart();
}

function populateChartTypeSelect() {
  if (!chartTypeSelect) return;
  chartTypeSelect.innerHTML = '';
  Object.entries(CHART_TYPES).forEach(([id, cfg]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = cfg.label;
    chartTypeSelect.appendChild(opt);
  });
}

function populateColumnDropdowns() {
  const cfg = getChartConfig();
  [labelSelect, ySelect, colorSelect].forEach((sel) => {
    if (!sel) return;
    const isColor = sel === colorSelect;
    const isLabel = sel === labelSelect;
    const prev = sel.value;
    if (isColor) {
      sel.innerHTML = '<option value="">None</option>';
    } else {
      sel.innerHTML = '';
    }
    table.headers.forEach((header, idx) => {
      if (isLabel && cfg.numericLabel && !numericCols.some((c) => c.colIdx === idx)) return;
      const opt = document.createElement('option');
      opt.value = String(idx);
      opt.textContent = header;
      sel.appendChild(opt);
    });
    if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
  });
}

function getChartConfig() {
  return CHART_TYPES[chartTypeSelect?.value ?? 'bar'] ?? CHART_TYPES.bar;
}

function applyChartTypeUI() {
  const cfg = getChartConfig();
  if (chartHint) chartHint.textContent = cfg.hint;
  if (labelTitle) labelTitle.textContent = cfg.labelTitle;
  if (valueTitle) valueTitle.textContent = cfg.valuesTitle || 'Value columns (numeric)';
  if (yTitle && cfg.yTitle) yTitle.textContent = cfg.yTitle;

  if (labelField) labelField.hidden = !cfg.needsLabel;
  if (yField) yField.hidden = !cfg.needsY;
  if (colorField) colorField.hidden = !cfg.color;

  populateValueControls();
  updateRangeControls(true);
}

function populateValueControls(selectedHeaders) {
  if (!valueList) return;
  const cfg = getChartConfig();
  const multi = cfg.values === 'multi';
  const selectedSet = selectedHeaders?.length ? new Set(selectedHeaders) : null;
  valueList.innerHTML = '';

  const cols = cfg.numericLabel
    ? numericCols
    : numericCols.length
      ? numericCols
      : columnNumericScores(table.headers, table.rows);

  const list = cfg.numericLabel ? numericCols : cols;

  if (!list.length) {
    valueList.innerHTML =
      '<p class="empty-state">No numeric columns detected. Upload data with numbers.</p>';
    return;
  }

  list.forEach(({ header, colIdx, numericRatio }) => {
    if (!cfg.numericLabel && numericRatio < 0.5) return;
    const label = document.createElement('label');
    label.className = 'checkbox-row';
    const input = document.createElement('input');
    input.type = multi ? 'checkbox' : 'radio';
    input.name = 'value-col';
    input.value = String(colIdx);
    input.dataset.header = header;
    if (selectedSet) {
      input.checked = selectedSet.has(header);
    } else if (multi) {
      input.checked = valueList.querySelectorAll('input').length < 3;
    } else if (!valueList.querySelector('input:checked')) {
      input.checked = true;
    }
    label.appendChild(input);
    label.appendChild(document.createTextNode(header));
    valueList.appendChild(label);
  });
}

function applySavedGraphConfig(chartType, config) {
  if (chartTypeSelect) chartTypeSelect.value = chartType;

  const cfg = CHART_TYPES[chartType] ?? CHART_TYPES.bar;
  if (chartHint) chartHint.textContent = cfg.hint;
  if (labelTitle) labelTitle.textContent = cfg.labelTitle;
  if (valueTitle) valueTitle.textContent = cfg.valuesTitle || 'Value columns (numeric)';
  if (yTitle && cfg.yTitle) yTitle.textContent = cfg.yTitle;
  if (labelField) labelField.hidden = !cfg.needsLabel;
  if (yField) yField.hidden = !cfg.needsY;
  if (colorField) colorField.hidden = !cfg.color;

  populateColumnDropdowns();

  const labelIdx = headerIndex(table.headers, config.labelColumn);
  const yIdx = headerIndex(table.headers, config.yColumn);
  const colorIdx = config.colorColumn ? headerIndex(table.headers, config.colorColumn) : null;

  if (labelIdx != null && labelSelect) labelSelect.value = String(labelIdx);
  if (yIdx != null && ySelect) ySelect.value = String(yIdx);
  if (colorSelect) colorSelect.value = colorIdx != null ? String(colorIdx) : '';

  populateValueControls(config.valueColumns ?? []);

  const selection = getColumnSelection();
  filterDefs = getFilterableColumns(selection);
  filtersInitialized = true;
  const base = defaultFilterState(table.rows, filterDefs);
  filterState = mergeFilterStateFromConfig(table.rows, filterDefs, config, base);
  updateRangeControls(false);
}

async function refreshSaveGraphUI() {
  const signedIn = await canSaveGraphs();
  const canSave = signedIn && activeDatasetSource === 'cloud';
  if (saveGraphField) saveGraphField.hidden = !canSave;
}

function showSaveGraphMsg(text, kind = 'ok') {
  if (!saveGraphMsg) return;
  saveGraphMsg.textContent = text;
  saveGraphMsg.className = `status-pill ${kind}`;
  saveGraphMsg.hidden = false;
  setTimeout(() => {
    saveGraphMsg.hidden = true;
  }, 3500);
}

async function handleSaveGraph() {
  if (activeDatasetSource !== 'cloud') {
    showSaveGraphMsg('Sign in and use a cloud dataset to save graphs.', 'warn');
    return;
  }

  const name = saveGraphNameInput?.value?.trim() ?? '';
  if (!name) {
    showSaveGraphMsg('Enter a name for this graph.', 'warn');
    return;
  }

  readFilterStateFromUI();
  const selection = getColumnSelection();
  const config = buildGraphConfig({
    headers: table.headers,
    labelIdx: selection.labelIdx,
    yIdx: selection.yIdx,
    colorIdx: selection.colorIdx,
    valueCols: selection.valueCols,
    filterDefs,
    filterState,
  });

  const spec = buildSpec();
  if (spec.error || !spec.rows?.length) {
    showSaveGraphMsg('Fix chart errors before saving.', 'err');
    return;
  }

  if (saveGraphBtn) saveGraphBtn.disabled = true;
  try {
    await saveSavedGraph({
      datasetId: activeDatasetId,
      name,
      chartType: selection.type,
      config,
    });
    loadedGraphName = name;
    showSaveGraphMsg(`Saved “${name}” to your account.`);
  } catch (err) {
    showSaveGraphMsg(err.message || 'Could not save graph.', 'err');
  } finally {
    if (saveGraphBtn) saveGraphBtn.disabled = false;
  }
}

function getSelectedValueCols() {
  const inputs = [...(valueList?.querySelectorAll('input:checked') ?? [])];
  return inputs.map((el) => ({
    colIdx: Number(el.value),
    header: el.dataset.header || table.headers[Number(el.value)],
  }));
}

function getColumnSelection() {
  const type = chartTypeSelect?.value ?? 'bar';
  const labelIdx = Number(labelSelect?.value ?? 0);
  const yIdx = Number(ySelect?.value ?? 0);
  const colorIdx = colorSelect?.value === '' ? null : Number(colorSelect.value);
  const valueCols = getSelectedValueCols();
  return { type, labelIdx, yIdx, colorIdx, valueCols, table };
}

function updateRangeControls(reset = false) {
  if (!rangeControls) return;

  const selection = getColumnSelection();
  filterDefs = getFilterableColumns(selection);

  if (!filterDefs.length) {
    rangeControls.innerHTML = '<p class="empty-state">Select columns above to configure range filters.</p>';
    if (rangeHint) {
      rangeHint.textContent =
        'Limit which rows appear in the chart. Controls adapt to each selected column.';
    }
    filterState = new Map();
    return;
  }

  if (reset || !filtersInitialized) {
    filterState = defaultFilterState(table.rows, filterDefs);
    filtersInitialized = true;
  } else {
    const next = defaultFilterState(table.rows, filterDefs);
    filterDefs.forEach((def) => {
      if (!filterState.has(def.colIdx)) {
        filterState.set(def.colIdx, next.get(def.colIdx));
      }
    });
    [...filterState.keys()].forEach((colIdx) => {
      if (!filterDefs.some((d) => d.colIdx === colIdx)) filterState.delete(colIdx);
    });
  }

  rangeControls.innerHTML = '';

  filterDefs.forEach((def) => {
    const kind = inferColumnKind(table.rows, def.colIdx);
    const state = filterState.get(def.colIdx);
    if (!state) return;

    const block = document.createElement('div');
    block.className = 'range-filter-block';
    block.dataset.colIdx = String(def.colIdx);

    const title = document.createElement('div');
    title.className = 'range-filter-title';
    title.textContent = `${def.header} (${describeFilterKind(kind, def.roles)})`;
    block.appendChild(title);

    if (kind === 'numeric') {
      const bounds = getNumericBounds(table.rows, def.colIdx);
      const row = document.createElement('div');
      row.className = 'range-numeric';

      const minLabel = document.createElement('label');
      minLabel.innerHTML = 'Min <input type="number" step="any" class="range-min">';
      const maxLabel = document.createElement('label');
      maxLabel.innerHTML = 'Max <input type="number" step="any" class="range-max">';

      const minInput = minLabel.querySelector('input');
      const maxInput = maxLabel.querySelector('input');
      minInput.value = state.min;
      maxInput.value = state.max;
      minInput.min = bounds.min;
      minInput.max = bounds.max;
      maxInput.min = bounds.min;
      maxInput.max = bounds.max;

      const sync = () => {
        let min = Number(minInput.value);
        let max = Number(maxInput.value);
        if (Number.isNaN(min)) min = bounds.min;
        if (Number.isNaN(max)) max = bounds.max;
        if (min > max) [min, max] = [max, min];
        state.min = min;
        state.max = max;
        minInput.value = min;
        maxInput.value = max;
      };

      minInput.addEventListener('change', () => {
        sync();
        drawChart();
      });
      maxInput.addEventListener('change', () => {
        sync();
        drawChart();
      });

      row.appendChild(minLabel);
      row.appendChild(maxLabel);
      block.appendChild(row);
    } else if (kind === 'date') {
      const bounds = getDateBounds(table.rows, def.colIdx);
      const row = document.createElement('div');
      row.className = 'range-numeric';

      const minLabel = document.createElement('label');
      minLabel.innerHTML = 'From <input type="date" class="range-min-date">';
      const maxLabel = document.createElement('label');
      maxLabel.innerHTML = 'To <input type="date" class="range-max-date">';

      const minInput = minLabel.querySelector('input');
      const maxInput = maxLabel.querySelector('input');
      minInput.value = state.min || bounds.min;
      maxInput.value = state.max || bounds.max;
      if (bounds.min) minInput.min = bounds.min;
      if (bounds.max) maxInput.max = bounds.max;

      const sync = () => {
        state.min = minInput.value;
        state.max = maxInput.value;
        state.minTime = state.min ? Date.parse(state.min) : -Infinity;
        state.maxTime = state.max ? Date.parse(`${state.max}T23:59:59`) : Infinity;
        if (state.minTime > state.maxTime) {
          [state.min, state.max] = [state.max, state.min];
          [state.minTime, state.maxTime] = [state.maxTime, state.minTime];
          minInput.value = state.min;
          maxInput.value = state.max;
        }
      };

      minInput.addEventListener('change', () => {
        sync();
        drawChart();
      });
      maxInput.addEventListener('change', () => {
        sync();
        drawChart();
      });

      row.appendChild(minLabel);
      row.appendChild(maxLabel);
      block.appendChild(row);
    } else {
      const values = getUniqueValues(table.rows, def.colIdx);
      const catWrap = document.createElement('div');
      catWrap.className = 'range-categories';

      const actions = document.createElement('div');
      actions.className = 'range-cat-actions';
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'btn btn-ghost btn-sm';
      allBtn.textContent = 'All';
      const noneBtn = document.createElement('button');
      noneBtn.type = 'button';
      noneBtn.className = 'btn btn-ghost btn-sm';
      noneBtn.textContent = 'None';
      actions.appendChild(allBtn);
      actions.appendChild(noneBtn);
      block.appendChild(actions);

      values.forEach(({ value, count }) => {
        const lab = document.createElement('label');
        lab.className = 'checkbox-row range-cat-row';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'range-cat-cb';
        cb.value = value;
        cb.checked = state.selected.has(value);
        cb.addEventListener('change', () => {
          if (cb.checked) state.selected.add(value);
          else state.selected.delete(value);
          drawChart();
        });
        lab.appendChild(cb);
        lab.appendChild(document.createTextNode(`${value} (${count})`));
        catWrap.appendChild(lab);
      });

      allBtn.addEventListener('click', () => {
        values.forEach(({ value }) => state.selected.add(value));
        catWrap.querySelectorAll('.range-cat-cb').forEach((cb) => {
          cb.checked = true;
        });
        drawChart();
      });
      noneBtn.addEventListener('click', () => {
        state.selected.clear();
        catWrap.querySelectorAll('.range-cat-cb').forEach((cb) => {
          cb.checked = false;
        });
        drawChart();
      });

      block.appendChild(catWrap);
    }

    rangeControls.appendChild(block);
  });

  if (rangeHint) {
    rangeHint.textContent = `Filtering ${filterDefs.length} column(s) from ${table.rows.length} total rows.`;
  }
}

function readFilterStateFromUI() {
  filterDefs.forEach((def) => {
    const state = filterState.get(def.colIdx);
    if (!state) return;
    const block = rangeControls?.querySelector(`[data-col-idx="${def.colIdx}"]`);
    if (!block) return;

    if (state.kind === 'numeric') {
      const minInput = block.querySelector('.range-min');
      const maxInput = block.querySelector('.range-max');
      if (minInput && maxInput) {
        state.min = Number(minInput.value);
        state.max = Number(maxInput.value);
      }
    } else if (state.kind === 'date') {
      const minInput = block.querySelector('.range-min-date');
      const maxInput = block.querySelector('.range-max-date');
      if (minInput && maxInput) {
        state.min = minInput.value;
        state.max = maxInput.value;
        state.minTime = state.min ? Date.parse(state.min) : -Infinity;
        state.maxTime = state.max ? Date.parse(`${state.max}T23:59:59`) : Infinity;
      }
    }
  });
}

function buildSpec() {
  const type = chartTypeSelect?.value ?? 'bar';
  const cfg = getChartConfig();
  const labelIdx = Number(labelSelect?.value ?? 0);
  const yIdx = Number(ySelect?.value ?? 0);
  const colorIdx = colorSelect?.value === '' ? null : Number(colorSelect?.value);
  const valueCols = getSelectedValueCols();

  readFilterStateFromUI();
  const filtered = applyRowFilters(table.rows, filterDefs, filterState);
  const rows = filtered.slice(0, MAX_ROWS);
  const totalRows = table.rows.length;
  const filteredCount = filtered.length;

  const base = {
    type,
    table,
    rows,
    colorIdx,
    filterMeta: { totalRows, filteredCount, capped: filteredCount > MAX_ROWS },
  };

  switch (type) {
    case 'scatter':
      if (valueCols.length < 1) return { error: 'Select a Y column.' };
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

function drawChart() {
  if (!canvas) return;
  const spec = buildSpec();
  if (spec.error) {
    setChartDownloadReady(false);
    const { ctx, w, h } = setupCanvasFallback();
    if (ctx) {
      ctx.fillStyle = getChartTheme().errorText;
      ctx.font = '14px DM Sans, system-ui, sans-serif';
      ctx.fillText(spec.error, 24, h / 2);
    }
    if (chartMeta) chartMeta.textContent = spec.error;
    return;
  }

  if (!spec.rows.length) {
    setChartDownloadReady(false);
    const { ctx, w, h } = setupCanvasFallback();
    if (ctx) {
      ctx.fillStyle = getChartTheme().errorText;
      ctx.font = '14px DM Sans, system-ui, sans-serif';
      ctx.fillText('No rows match the current range filters.', 24, h / 2);
    }
    if (chartMeta) {
      chartMeta.textContent = `No rows match filters (from ${spec.filterMeta?.totalRows ?? 0} total). Widen the range or select more categories.`;
    }
    return;
  }

  const msg = renderChart(canvas, spec);
  setChartDownloadReady(true);
  if (chartMeta) {
    const fm = spec.filterMeta;
    let meta = msg;
    if (fm && fm.filteredCount < fm.totalRows) {
      meta += ` · Showing ${spec.rows.length} of ${fm.filteredCount} matching rows (${fm.totalRows} total)`;
      if (fm.capped) meta += ` · capped at ${MAX_ROWS}`;
    }
    chartMeta.textContent = meta;
  }
  canvas.setAttribute('aria-label', `${getChartConfig().label} chart`);
}

function setupCanvasFallback() {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 640;
  const h = canvas.clientHeight || 360;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = getChartTheme().bg;
  ctx.fillRect(0, 0, w, h);
  return { ctx, w, h };
}

function bindEvents() {
  renderBtn?.addEventListener('click', drawChart);
  downloadChartBtn?.addEventListener('click', () => {
    if (!chartDownloadReady || !canvas) return;
    const chartType = chartTypeSelect?.value ?? 'chart';
    const base = sanitizeFilename(activeDatasetName || 'chart');
    const graphPart = loadedGraphName ? `-${sanitizeFilename(loadedGraphName)}` : '';
    const filename = `${base}${graphPart}-${chartType}-chart.png`;
    downloadCanvasPng(canvas, filename);
  });
  saveGraphBtn?.addEventListener('click', handleSaveGraph);
  resetFiltersBtn?.addEventListener('click', () => {
    updateRangeControls(true);
    drawChart();
  });
  chartTypeSelect?.addEventListener('change', () => {
    populateColumnDropdowns();
    applyChartTypeUI();
    drawChart();
  });
  labelSelect?.addEventListener('change', () => {
    updateRangeControls(false);
    drawChart();
  });
  ySelect?.addEventListener('change', () => {
    updateRangeControls(false);
    drawChart();
  });
  colorSelect?.addEventListener('change', () => {
    updateRangeControls(false);
    drawChart();
  });
  valueList?.addEventListener('change', () => {
    updateRangeControls(false);
    drawChart();
  });
}

init();
window.addEventListener('resize', () => drawChart());
window.addEventListener('datavis-themechange', () => drawChart());
