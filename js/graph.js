import {
  getActiveDataset,
  datasetToTable,
  columnNumericScores,
} from './storage.js';

const emptyState = document.getElementById('graph-empty');
const chartPanel = document.getElementById('chart-panel');
const datasetTitle = document.getElementById('graph-dataset-name');
const labelSelect = document.getElementById('label-column');
const valueList = document.getElementById('value-columns');
const canvas = document.getElementById('chart-canvas');
const chartMeta = document.getElementById('chart-meta');
const renderBtn = document.getElementById('render-chart');

const MAX_ROWS = 24;
const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ec4899', '#14b8a6'];

let table = { headers: [], rows: [] };

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
  populateColumnControls();
  renderBtn?.addEventListener('click', drawChart);
  labelSelect?.addEventListener('change', drawChart);
  valueList?.addEventListener('change', drawChart);
  drawChart();
}

function populateColumnControls() {
  if (!labelSelect || !valueList) return;
  labelSelect.innerHTML = '';
  valueList.innerHTML = '';

  const scores = columnNumericScores(table.headers, table.rows);

  table.headers.forEach((header, idx) => {
    const opt = document.createElement('option');
    opt.value = String(idx);
    opt.textContent = header;
    labelSelect.appendChild(opt);
  });

  scores.forEach(({ header, colIdx, numericRatio }) => {
    if (numericRatio < 0.5) return;
    const label = document.createElement('label');
    label.className = 'checkbox-row';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = String(colIdx);
    cb.dataset.header = header;
    cb.checked = valueList.children.length < 3;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(header));
    valueList.appendChild(label);
  });

  if (!valueList.children.length) {
    valueList.innerHTML = '<p class="empty-state">No numeric columns detected. Upload data with numbers to compare.</p>';
  }
}

function drawChart() {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const labelIdx = Number(labelSelect?.value ?? 0);
  const valueChecks = [...(valueList?.querySelectorAll('input[type="checkbox"]:checked') ?? [])];

  if (!valueChecks.length) {
    if (chartMeta) chartMeta.textContent = 'Select at least one numeric column to compare.';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  const series = valueChecks.map((cb) => ({
    header: cb.dataset.header || table.headers[Number(cb.value)],
    colIdx: Number(cb.value),
  }));

  const slice = table.rows.slice(0, MAX_ROWS);
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 640;
  const h = canvas.clientHeight || 360;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const pad = { top: 28, right: 16, bottom: 72, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  let maxVal = 0;
  series.forEach((s) => {
    slice.forEach((row) => {
      const v = Number(row[s.colIdx]);
      if (!Number.isNaN(v)) maxVal = Math.max(maxVal, v);
    });
  });
  if (maxVal <= 0) maxVal = 1;

  const groupCount = slice.length;
  const barGap = 4;
  const groupW = plotW / Math.max(groupCount, 1);
  const barW = Math.max(4, (groupW - barGap) / series.length - 2);

  ctx.strokeStyle = '#2d3748';
  ctx.fillStyle = '#9aa5b8';
  ctx.font = '11px DM Sans, system-ui, sans-serif';

  for (let t = 0; t <= 4; t += 1) {
    const y = pad.top + plotH - (plotH * t) / 4;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
    const val = (maxVal * t) / 4;
    ctx.fillText(val.toLocaleString(undefined, { maximumFractionDigits: 2 }), 4, y + 4);
  }

  slice.forEach((row, gi) => {
    const gx = pad.left + gi * groupW + barGap / 2;
    series.forEach((s, si) => {
      const num = Number(row[s.colIdx]);
      const val = Number.isNaN(num) ? 0 : num;
      const bh = (val / maxVal) * plotH;
      const x = gx + si * (barW + 2);
      const y = pad.top + plotH - bh;
      ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
      ctx.fillRect(x, y, barW, bh);
    });
  });

  ctx.save();
  ctx.fillStyle = '#9aa5b8';
  ctx.textAlign = 'right';
  slice.forEach((row, gi) => {
    const gx = pad.left + gi * groupW + groupW / 2;
    const label = String(row[labelIdx] ?? '').slice(0, 14);
    ctx.translate(gx, pad.top + plotH + 10);
    ctx.rotate(-0.45);
    ctx.fillText(label, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  });
  ctx.restore();

  const legendY = 12;
  series.forEach((s, si) => {
    ctx.fillStyle = CHART_COLORS[si % CHART_COLORS.length];
    ctx.fillRect(pad.left + si * 110, legendY, 10, 10);
    ctx.fillStyle = '#e8edf5';
    ctx.fillText(s.header, pad.left + si * 110 + 14, legendY + 9);
  });

  if (chartMeta) {
    chartMeta.textContent = `Comparing ${series.map((s) => s.header).join(', ')} by ${table.headers[labelIdx]} (first ${slice.length} rows).`;
  }
}

init();
window.addEventListener('resize', () => drawChart());
