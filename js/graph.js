import {
  getActiveDataset,
  datasetToTable,
  columnNumericScores,
} from './storage.js';
import { renderChart, MAX_ROWS } from './chart-renderers.js';

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
const canvas = document.getElementById('chart-canvas');
const chartMeta = document.getElementById('chart-meta');
const renderBtn = document.getElementById('render-chart');

let table = { headers: [], rows: [] };
let numericCols = [];

function init() {
  const dataset = getActiveDataset();
  if (!dataset) {
    if (emptyState) emptyState.hidden = false;
    if (chartPanel) chartPanel.hidden = true;
    return;
  }

  if (emptyState) emptyState.hidden = true;
  if (chartPanel) chartPanel.hidden = false;
  if (datasetTitle) datasetTitle.textContent = dataset.name;

  table = datasetToTable(dataset);
  numericCols = columnNumericScores(table.headers, table.rows).filter((c) => c.numericRatio >= 0.5);

  populateChartTypeSelect();
  populateColumnDropdowns();
  applyChartTypeUI();
  bindEvents();
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
}

function populateValueControls() {
  if (!valueList) return;
  const cfg = getChartConfig();
  const multi = cfg.values === 'multi';
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
    if (multi) {
      input.checked = valueList.querySelectorAll('input').length < 3;
    } else if (!valueList.querySelector('input:checked')) {
      input.checked = true;
    }
    label.appendChild(input);
    label.appendChild(document.createTextNode(header));
    valueList.appendChild(label);
  });
}

function getSelectedValueCols() {
  const inputs = [...(valueList?.querySelectorAll('input:checked') ?? [])];
  return inputs.map((el) => ({
    colIdx: Number(el.value),
    header: el.dataset.header || table.headers[Number(el.value)],
  }));
}

function buildSpec() {
  const type = chartTypeSelect?.value ?? 'bar';
  const cfg = getChartConfig();
  const rows = table.rows.slice(0, MAX_ROWS);
  const labelIdx = Number(labelSelect?.value ?? 0);
  const yIdx = Number(ySelect?.value ?? 0);
  const colorIdx = colorSelect?.value === '' ? null : Number(colorSelect?.value);
  const valueCols = getSelectedValueCols();

  const base = { type, table, rows, colorIdx };

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
    const { ctx, w, h } = setupCanvasFallback();
    if (ctx) {
      ctx.fillStyle = '#9aa5b8';
      ctx.font = '14px DM Sans, system-ui, sans-serif';
      ctx.fillText(spec.error, 24, h / 2);
    }
    if (chartMeta) chartMeta.textContent = spec.error;
    return;
  }
  const msg = renderChart(canvas, spec);
  if (chartMeta) chartMeta.textContent = msg;
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
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

function bindEvents() {
  renderBtn?.addEventListener('click', drawChart);
  chartTypeSelect?.addEventListener('change', () => {
    populateColumnDropdowns();
    applyChartTypeUI();
    drawChart();
  });
  labelSelect?.addEventListener('change', drawChart);
  ySelect?.addEventListener('change', drawChart);
  colorSelect?.addEventListener('change', drawChart);
  valueList?.addEventListener('change', drawChart);
}

init();
window.addEventListener('resize', () => drawChart());
