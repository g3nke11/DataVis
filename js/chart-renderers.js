/**
 * Canvas chart renderers for DataVis.
 */

export const PALETTE = [
  '#3b82f6',
  '#22c55e',
  '#f59e0b',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#ef4444',
  '#84cc16',
  '#06b6d4',
  '#eab308',
];

export const MAX_ROWS = 200;

export function setupCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth || 640;
  const h = canvas.clientHeight || 360;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h, dpr };
}

export function buildColorMap(rows, colorIdx) {
  const map = new Map();
  if (colorIdx == null || colorIdx === '') return map;
  rows.forEach((row) => {
    const key = String(row[colorIdx] ?? '').trim() || '(blank)';
    if (!map.has(key)) map.set(key, PALETTE[map.size % PALETTE.length]);
  });
  return map;
}

function colorForRow(row, colorIdx, colorMap, fallback) {
  if (colorIdx == null || colorIdx === '' || !colorMap.size) return fallback;
  const key = String(row[colorIdx] ?? '').trim() || '(blank)';
  return colorMap.get(key) ?? fallback;
}

function drawGrid(ctx, pad, plotW, plotH, maxVal) {
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
}

function drawRotatedLabels(ctx, pad, plotW, plotH, labels, dpr) {
  ctx.save();
  ctx.fillStyle = '#9aa5b8';
  ctx.textAlign = 'right';
  const groupW = plotW / Math.max(labels.length, 1);
  labels.forEach((label, gi) => {
    const gx = pad.left + gi * groupW + groupW / 2;
    ctx.translate(gx, pad.top + plotH + 10);
    ctx.rotate(-0.45);
    ctx.fillText(String(label).slice(0, 14), 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  });
  ctx.restore();
}

function drawLegend(ctx, items, x = 8, y = 8) {
  items.forEach((item, i) => {
    const lx = x + i * 118;
    ctx.fillStyle = item.color;
    ctx.fillRect(lx, y, 10, 10);
    ctx.fillStyle = '#e8edf5';
    ctx.font = '11px DM Sans, system-ui, sans-serif';
    ctx.fillText(item.label.slice(0, 16), lx + 14, y + 9);
  });
}

export function drawBarChart(canvas, { table, labelIdx, valueCols, colorIdx, rows }) {
  const { ctx, w, h, dpr } = setupCanvas(canvas);
  const pad = { top: 36, right: 16, bottom: 72, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const colorMap = buildColorMap(rows, colorIdx);

  let maxVal = 0;
  valueCols.forEach((s) => {
    rows.forEach((row) => {
      const v = Number(row[s.colIdx]);
      if (!Number.isNaN(v)) maxVal = Math.max(maxVal, v);
    });
  });
  if (maxVal <= 0) maxVal = 1;

  drawGrid(ctx, pad, plotW, plotH, maxVal);

  const groupCount = rows.length;
  const barGap = 4;
  const groupW = plotW / Math.max(groupCount, 1);
  const barW = Math.max(3, (groupW - barGap) / valueCols.length - 2);
  const labels = [];

  rows.forEach((row, gi) => {
    labels.push(row[labelIdx] ?? '');
    const gx = pad.left + gi * groupW + barGap / 2;
    valueCols.forEach((s, si) => {
      const num = Number(row[s.colIdx]);
      const val = Number.isNaN(num) ? 0 : num;
      const bh = (val / maxVal) * plotH;
      const x = gx + si * (barW + 2);
      const y = pad.top + plotH - bh;
      const seriesColor = PALETTE[si % PALETTE.length];
      ctx.fillStyle = colorForRow(row, colorIdx, colorMap, seriesColor);
      ctx.fillRect(x, y, barW, bh);
    });
  });

  drawRotatedLabels(ctx, pad, plotW, plotH, labels, dpr);

  const legendItems = colorMap.size
    ? [...colorMap.entries()].map(([label, color]) => ({ label, color }))
    : valueCols.map((s, si) => ({ label: s.header, color: PALETTE[si % PALETTE.length] }));
  drawLegend(ctx, legendItems);

  return describeBar(table, labelIdx, valueCols, rows, colorIdx);
}

export function drawLineChart(canvas, { table, labelIdx, valueCols, colorIdx, rows }) {
  const { ctx, w, h, dpr } = setupCanvas(canvas);
  const pad = { top: 36, right: 16, bottom: 72, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const colorMap = buildColorMap(rows, colorIdx);

  let maxVal = 0;
  let minVal = 0;
  valueCols.forEach((s) => {
    rows.forEach((row) => {
      const v = Number(row[s.colIdx]);
      if (!Number.isNaN(v)) {
        maxVal = Math.max(maxVal, v);
        minVal = Math.min(minVal, v);
      }
    });
  });
  const range = maxVal - minVal || 1;
  const scaleY = (v) => pad.top + plotH - ((v - minVal) / range) * plotH;
  const n = Math.max(rows.length, 1);

  drawGrid(ctx, pad, plotW, plotH, maxVal);

  valueCols.forEach((s, si) => {
    const seriesColor = PALETTE[si % PALETTE.length];
    ctx.strokeStyle = seriesColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    rows.forEach((row, i) => {
      const v = Number(row[s.colIdx]);
      if (Number.isNaN(v)) return;
      const x = pad.left + (i / Math.max(n - 1, 1)) * plotW;
      const y = scaleY(v);
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else ctx.lineTo(x, y);
    });
    ctx.stroke();

    rows.forEach((row, i) => {
      const v = Number(row[s.colIdx]);
      if (Number.isNaN(v)) return;
      const x = pad.left + (i / Math.max(n - 1, 1)) * plotW;
      const y = scaleY(v);
      ctx.fillStyle = colorForRow(row, colorIdx, colorMap, seriesColor);
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  drawRotatedLabels(
    ctx,
    pad,
    plotW,
    plotH,
    rows.map((r) => r[labelIdx] ?? ''),
    dpr
  );

  const legendItems = colorMap.size
    ? [...colorMap.entries()].map(([label, color]) => ({ label, color }))
    : valueCols.map((s, si) => ({ label: s.header, color: PALETTE[si % PALETTE.length] }));
  drawLegend(ctx, legendItems);

  return describeLine(table, labelIdx, valueCols, rows, colorIdx);
}

export function drawScatterChart(canvas, { table, xIdx, yIdx, colorIdx, rows }) {
  const { ctx, w, h } = setupCanvas(canvas);
  const pad = { top: 36, right: 16, bottom: 52, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const colorMap = buildColorMap(rows, colorIdx);

  const points = rows
    .map((row) => ({
      x: Number(row[xIdx]),
      y: Number(row[yIdx]),
      row,
    }))
    .filter((p) => !Number.isNaN(p.x) && !Number.isNaN(p.y));

  if (!points.length) return 'No numeric X/Y pairs to plot.';

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  points.forEach((p) => {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  });
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  drawGrid(ctx, pad, plotW, plotH, maxY);

  ctx.fillStyle = '#9aa5b8';
  ctx.fillText(table.headers[xIdx], pad.left + plotW / 2 - 20, h - 12);
  ctx.save();
  ctx.translate(14, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(table.headers[yIdx], 0, 0);
  ctx.restore();

  points.forEach((p) => {
    const cx = pad.left + ((p.x - minX) / rangeX) * plotW;
    const cy = pad.top + plotH - ((p.y - minY) / rangeY) * plotH;
    ctx.fillStyle = colorForRow(p.row, colorIdx, colorMap, PALETTE[0]);
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  if (colorMap.size) drawLegend(ctx, [...colorMap.entries()].map(([label, color]) => ({ label, color })));

  return `Scatter: ${table.headers[xIdx]} vs ${table.headers[yIdx]} (${points.length} points)${
    colorIdx !== '' && colorIdx != null ? `, colored by ${table.headers[colorIdx]}` : ''
  }.`;
}

export function drawHistogram(canvas, { table, valueCol, colorIdx, rows, bins = 12 }) {
  const { ctx, w, h, dpr } = setupCanvas(canvas);
  const pad = { top: 36, right: 16, bottom: 52, left: 52 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const colorMap = buildColorMap(rows, colorIdx);

  const groups = new Map();
  if (colorIdx != null && colorIdx !== '') {
    rows.forEach((row) => {
      const key = String(row[colorIdx] ?? '').trim() || '(blank)';
      if (!groups.has(key)) groups.set(key, []);
      const v = Number(row[valueCol.colIdx]);
      if (!Number.isNaN(v)) groups.get(key).push(v);
    });
  } else {
    const vals = rows.map((r) => Number(r[valueCol.colIdx])).filter((v) => !Number.isNaN(v));
    groups.set(valueCol.header, vals);
  }

  const allVals = [...groups.values()].flat();
  if (!allVals.length) return 'No numeric values for histogram.';

  let min = Math.min(...allVals);
  let max = Math.max(...allVals);
  if (min === max) {
    min -= 0.5;
    max += 0.5;
  }
  const binWidth = (max - min) / bins || 1;

  const binLabels = [];
  const countsByGroup = [];

  groups.forEach((vals, name) => {
    const counts = new Array(bins).fill(0);
    vals.forEach((v) => {
      let idx = Math.floor((v - min) / binWidth);
      if (idx >= bins) idx = bins - 1;
      if (idx < 0) idx = 0;
      counts[idx] += 1;
    });
    countsByGroup.push({ name, counts, color: colorMap.get(name) ?? PALETTE[countsByGroup.length % PALETTE.length] });
  });

  for (let i = 0; i < bins; i += 1) {
    const lo = min + i * binWidth;
    binLabels.push(lo.toFixed(1));
  }

  let maxCount = 0;
  countsByGroup.forEach((g) => {
    g.counts.forEach((c) => {
      maxCount = Math.max(maxCount, c);
    });
  });
  if (maxCount <= 0) maxCount = 1;

  drawGrid(ctx, pad, plotW, plotH, maxCount);

  const groupCount = countsByGroup.length;
  const barGap = 2;
  const binW = plotW / bins;
  const innerW = (binW - barGap) / groupCount;

  countsByGroup.forEach((g, gi) => {
    g.counts.forEach((count, bi) => {
      const bh = (count / maxCount) * plotH;
      const x = pad.left + bi * binW + barGap / 2 + gi * innerW;
      const y = pad.top + plotH - bh;
      ctx.fillStyle = g.color;
      ctx.globalAlpha = groupCount > 1 ? 0.85 : 1;
      ctx.fillRect(x, y, Math.max(2, innerW - 1), bh);
    });
  });
  ctx.globalAlpha = 1;

  drawRotatedLabels(ctx, pad, plotW, plotH, binLabels, dpr);

  drawLegend(
    ctx,
    countsByGroup.map((g) => ({ label: g.name, color: g.color }))
  );

  return `Histogram of ${valueCol.header} (${bins} bins, ${allVals.length} values)${
    colorIdx !== '' && colorIdx != null ? `, split by ${table.headers[colorIdx]}` : ''
  }.`;
}

export function drawPieChart(canvas, { table, labelIdx, valueCol, colorIdx, rows }) {
  const { ctx, w, h } = setupCanvas(canvas);
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(w, h) * 0.32;
  const colorMap = buildColorMap(rows, colorIdx);

  const totals = new Map();
  rows.forEach((row) => {
    const label = String(row[labelIdx] ?? '').trim() || '(blank)';
    const v = Number(row[valueCol.colIdx]);
    if (Number.isNaN(v)) return;
    totals.set(label, (totals.get(label) || 0) + v);
  });

  const slices = [...totals.entries()];
  if (!slices.length) return 'No numeric values for pie chart.';

  const sum = slices.reduce((a, [, v]) => a + v, 0) || 1;
  let start = -Math.PI / 2;

  slices.forEach(([label, value], i) => {
    const angle = (value / sum) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, start, start + angle);
    ctx.closePath();
    const sliceColor =
      colorMap.get(label) ?? PALETTE[i % PALETTE.length];
    ctx.fillStyle = sliceColor;
    ctx.fill();
    start += angle;
  });

  drawLegend(
    ctx,
    slices.map(([label], i) => ({
      label: `${label} (${((totals.get(label) / sum) * 100).toFixed(0)}%)`,
      color: colorMap.get(label) ?? PALETTE[i % PALETTE.length],
    })),
    8,
    h - 28
  );

  return `Pie: ${table.headers[labelIdx]} by ${valueCol.header} (${slices.length} slices).`;
}

export function drawHeatmap(canvas, { table, xIdx, yIdx, valueCol, rows }) {
  const { ctx, w, h } = setupCanvas(canvas);
  const pad = { top: 28, right: 12, bottom: 80, left: 100 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const xCats = [];
  const yCats = [];
  rows.forEach((row) => {
    const x = String(row[xIdx] ?? '').trim() || '(blank)';
    const y = String(row[yIdx] ?? '').trim() || '(blank)';
    if (!xCats.includes(x)) xCats.push(x);
    if (!yCats.includes(y)) yCats.push(y);
  });

  const grid = new Map();
  let min = Infinity;
  let max = -Infinity;

  rows.forEach((row) => {
    const x = String(row[xIdx] ?? '').trim() || '(blank)';
    const y = String(row[yIdx] ?? '').trim() || '(blank)';
    const v = Number(row[valueCol.colIdx]);
    if (Number.isNaN(v)) return;
    const key = `${x}\0${y}`;
    const next = (grid.get(key) || 0) + v;
    grid.set(key, next);
    min = Math.min(min, next);
    max = Math.max(max, next);
  });

  if (!grid.size) return 'No numeric values for heatmap.';

  const cellW = plotW / Math.max(xCats.length, 1);
  const cellH = plotH / Math.max(yCats.length, 1);
  const range = max - min || 1;

  yCats.forEach((y, yi) => {
    xCats.forEach((x, xi) => {
      const val = grid.get(`${x}\0${y}`) ?? 0;
      const t = (val - min) / range;
      ctx.fillStyle = heatColor(t);
      ctx.fillRect(pad.left + xi * cellW, pad.top + yi * cellH, cellW - 1, cellH - 1);
    });
  });

  ctx.fillStyle = '#9aa5b8';
  ctx.font = '10px DM Sans, system-ui, sans-serif';
  xCats.forEach((x, xi) => {
    const tx = pad.left + xi * cellW + cellW / 2;
    ctx.save();
    ctx.translate(tx, pad.top + plotH + 8);
    ctx.rotate(-0.4);
    ctx.fillText(x.slice(0, 12), 0, 0);
    ctx.restore();
  });
  yCats.forEach((y, yi) => {
    ctx.fillText(y.slice(0, 14), 4, pad.top + yi * cellH + cellH / 2 + 4);
  });

  ctx.fillStyle = '#e8edf5';
  ctx.fillText(`${table.headers[valueCol.colIdx]}: ${min.toFixed(2)} → ${max.toFixed(2)}`, pad.left, 12);

  return `Heatmap: ${table.headers[xIdx]} × ${table.headers[yIdx]}, cell value = ${valueCol.header}.`;
}

function heatColor(t) {
  const r = Math.round(30 + t * 200);
  const g = Math.round(40 + (1 - Math.abs(t - 0.5) * 2) * 120);
  const b = Math.round(200 - t * 170);
  return `rgb(${r},${g},${b})`;
}

function describeBar(table, labelIdx, valueCols, rows, colorIdx) {
  const color =
    colorIdx !== '' && colorIdx != null ? `, colored by ${table.headers[colorIdx]}` : '';
  return `Grouped bar: ${valueCols.map((s) => s.header).join(', ')} by ${table.headers[labelIdx]} (${rows.length} rows)${color}.`;
}

function describeLine(table, labelIdx, valueCols, rows, colorIdx) {
  const color =
    colorIdx !== '' && colorIdx != null ? `, points colored by ${table.headers[colorIdx]}` : '';
  return `Line chart: ${valueCols.map((s) => s.header).join(', ')} over ${table.headers[labelIdx]} (${rows.length} rows)${color}.`;
}

export function renderChart(canvas, spec) {
  switch (spec.type) {
    case 'bar':
      return drawBarChart(canvas, spec);
    case 'line':
      return drawLineChart(canvas, spec);
    case 'scatter':
      return drawScatterChart(canvas, spec);
    case 'histogram':
      return drawHistogram(canvas, spec);
    case 'pie':
      return drawPieChart(canvas, spec);
    case 'heatmap':
      return drawHeatmap(canvas, spec);
    default:
      return 'Unknown chart type.';
  }
}
