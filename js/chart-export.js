/**
 * Render a saved graph config to PNG (offscreen canvas).
 */

import { datasetToTable } from './storage.js';
import { buildChartSpec } from './graph-config.js';
import { renderChart } from './chart-renderers.js';
import { downloadCanvasPng, sanitizeFilename } from './download-utils.js';

export function renderSavedGraphToCanvas(dataset, savedGraph, canvas) {
  const table = datasetToTable(dataset);
  const spec = buildChartSpec(table, savedGraph.chartType, savedGraph.config);
  if (spec.error) throw new Error(spec.error);
  if (!spec.rows.length) throw new Error('No rows match the saved graph filters.');

  canvas.style.width = '640px';
  canvas.style.height = '360px';
  renderChart(canvas, spec);
  return spec;
}

export async function downloadSavedGraphPng(dataset, savedGraph) {
  const canvas = document.createElement('canvas');
  canvas.className = 'chart-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'fixed';
  canvas.style.left = '-9999px';
  document.body.appendChild(canvas);

  try {
    renderSavedGraphToCanvas(dataset, savedGraph, canvas);
    const dsBase = sanitizeFilename(dataset.name.replace(/\.[^.]+$/, '') || dataset.name);
    const graphBase = sanitizeFilename(savedGraph.name);
    const filename = `${dsBase}-${graphBase}-${savedGraph.chartType}.png`;
    downloadCanvasPng(canvas, filename);
  } finally {
    canvas.remove();
  }
}
