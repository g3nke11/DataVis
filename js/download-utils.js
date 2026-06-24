/**
 * Browser download helpers for exports (charts, CSV, JSON).
 */

export function sanitizeFilename(name) {
  const base = String(name ?? 'download')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base.slice(0, 80) || 'download';
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadText(text, filename, mime = 'text/plain;charset=utf-8') {
  downloadBlob(new Blob([text], { type: mime }), filename);
}

export function downloadJson(data, filename) {
  downloadText(JSON.stringify(data, null, 2), filename, 'application/json;charset=utf-8');
}

export function downloadCanvasPng(canvas, filename) {
  if (!canvas) return;
  canvas.toBlob(
    (blob) => {
      if (blob) downloadBlob(blob, filename);
    },
    'image/png',
    1
  );
}

export function csvEscape(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
