/**
 * Browser-local dataset catalog (short-term, per device).
 */

export const STORAGE_KEYS = {
  displayName: 'datavis_user_displayName',
  themeNote: 'datavis_user_note',
  catalog: 'datavis_datasets',
  activeDatasetId: 'datavis_active_dataset_id',
};

export function loadUserPrefs() {
  return {
    displayName: localStorage.getItem(STORAGE_KEYS.displayName) || '',
    themeNote: localStorage.getItem(STORAGE_KEYS.themeNote) || '',
  };
}

export function saveUserPrefs({ displayName, themeNote }) {
  localStorage.setItem(STORAGE_KEYS.displayName, displayName);
  localStorage.setItem(STORAGE_KEYS.themeNote, themeNote);
}

export function clearUserPrefs() {
  localStorage.removeItem(STORAGE_KEYS.displayName);
  localStorage.removeItem(STORAGE_KEYS.themeNote);
}

function readCatalog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.catalog);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeCatalog(datasets) {
  localStorage.setItem(STORAGE_KEYS.catalog, JSON.stringify(datasets));
}

export function listStoredDatasets() {
  return readCatalog().sort((a, b) => (b.uploadedAt || '').localeCompare(a.uploadedAt || ''));
}

export function getStoredDataset(id) {
  return readCatalog().find((d) => d.id === id) ?? null;
}

export function setActiveDatasetId(id) {
  if (id) localStorage.setItem(STORAGE_KEYS.activeDatasetId, id);
  else localStorage.removeItem(STORAGE_KEYS.activeDatasetId);
}

export function getActiveDatasetId() {
  return localStorage.getItem(STORAGE_KEYS.activeDatasetId) || '';
}

export function getActiveDataset() {
  const id = getActiveDatasetId();
  return id ? getStoredDataset(id) : null;
}

export function deleteStoredDataset(id) {
  const next = readCatalog().filter((d) => d.id !== id);
  writeCatalog(next);
  if (getActiveDatasetId() === id) setActiveDatasetId(null);
}

export function saveStoredDataset({ name, text, mime }) {
  const table = datasetToTable({ name, text, mime });
  const entry = {
    id: crypto.randomUUID(),
    name,
    mime: mime || guessMime(name),
    text,
    uploadedAt: new Date().toISOString(),
    rowCount: table.rows.length,
    columns: table.headers,
  };
  const catalog = readCatalog();
  catalog.push(entry);
  writeCatalog(catalog);
  return entry;
}

function guessMime(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  return 'text/plain';
}

export function parseCsv(text) {
  const lines = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // ignore
    } else if (c === '\n') {
      row.push(field);
      lines.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  row.push(field);
  if (field.length || row.length > 1) lines.push(row);
  return lines;
}

function jsonToTable(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) {
    if (!data.length) return { headers: [], rows: [] };
    if (typeof data[0] === 'object' && data[0] !== null) {
      const headers = [...new Set(data.flatMap((row) => Object.keys(row)))];
      const rows = data.map((row) => headers.map((h) => String(row[h] ?? '')));
      return { headers, rows };
    }
    return { headers: ['value'], rows: data.map((v) => [String(v)]) };
  }
  if (typeof data === 'object' && data !== null) {
    const headers = Object.keys(data);
    return { headers, rows: [headers.map((h) => String(data[h]))] };
  }
  return { headers: ['value'], rows: [[String(data)]] };
}

export function datasetToTable(dataset) {
  const lower = dataset.name.toLowerCase();
  if (lower.endsWith('.csv') || dataset.mime === 'text/csv') {
    const lines = parseCsv(dataset.text.trimEnd());
    if (!lines.length) return { headers: [], rows: [] };
    const [headers, ...rows] = lines;
    return { headers, rows };
  }
  if (lower.endsWith('.json') || dataset.mime === 'application/json') {
    return jsonToTable(dataset.text);
  }
  return { headers: ['text'], rows: dataset.text.split('\n').map((line) => [line]) };
}

export function columnNumericScores(headers, rows) {
  return headers.map((header, colIdx) => {
    let numeric = 0;
    let total = 0;
    for (const row of rows) {
      const val = row[colIdx]?.trim();
      if (val === '' || val == null) continue;
      total += 1;
      if (!Number.isNaN(Number(val))) numeric += 1;
    }
    return { header, colIdx, numericRatio: total ? numeric / total : 0 };
  });
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
