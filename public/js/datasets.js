import { fetchConfig, listDatasets, fetchDatasetFile } from './api.js';

const tableBody = document.querySelector('#datasets-table tbody');
const errorBanner = document.getElementById('datasets-error');
const metaEl = document.getElementById('dataset-meta');
const previewTitle = document.getElementById('preview-title');
const jsonPre = document.getElementById('json-preview');
const csvWrap = document.getElementById('csv-preview');
const rawNote = document.getElementById('raw-note');

function showError(msg) {
  if (!errorBanner) return;
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
}

function clearError() {
  if (errorBanner) errorBanner.hidden = true;
}

function parseCsv(text) {
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

function renderCsv(rows) {
  if (!csvWrap) return;
  csvWrap.innerHTML = '';
  if (!rows.length) {
    csvWrap.textContent = 'Empty CSV.';
    return;
  }
  const tbl = document.createElement('table');
  tbl.className = 'preview-table';
  const thead = document.createElement('thead');
  const trHead = document.createElement('tr');
  rows[0].forEach((h) => {
    const th = document.createElement('th');
    th.textContent = h;
    trHead.appendChild(th);
  });
  thead.appendChild(trHead);
  tbl.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.slice(1).forEach((line) => {
    const tr = document.createElement('tr');
    rows[0].forEach((_c, idx) => {
      const td = document.createElement('td');
      td.textContent = line[idx] ?? '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  csvWrap.appendChild(tbl);
}

function renderPreview(dataset) {
  if (!dataset) return;
  const name = dataset.name;
  const lower = name.toLowerCase();

  previewTitle.textContent = name;
  if (metaEl) {
    metaEl.textContent = `${dataset.mime} · ${dataset.path}`;
  }

  jsonPre.hidden = true;
  csvWrap.hidden = true;
  rawNote.hidden = true;
  jsonPre.textContent = '';

  if (lower.endsWith('.json')) {
    try {
      const obj = JSON.parse(dataset.text);
      jsonPre.textContent = JSON.stringify(obj, null, 2);
      jsonPre.hidden = false;
    } catch {
      rawNote.hidden = false;
      rawNote.textContent = 'File has a .json extension but is not valid JSON; showing plain text.';
      jsonPre.textContent = dataset.text;
      jsonPre.hidden = false;
    }
    return;
  }

  if (lower.endsWith('.csv')) {
    csvWrap.hidden = false;
    renderCsv(parseCsv(dataset.text.trimEnd()));
    return;
  }

  rawNote.hidden = false;
  rawNote.textContent = 'Showing raw text (.csv and .json get structured previews).';
  jsonPre.textContent = dataset.text;
  jsonPre.hidden = false;
}

async function loadList() {
  clearError();
  if (!tableBody) return;
  tableBody.innerHTML = '';
  let cfg;
  try {
    cfg = await fetchConfig();
  } catch (e) {
    showError(e.message || String(e));
    return;
  }
  if (!(cfg.owner && cfg.repo)) {
    showError('Server is missing GITHUB_OWNER / GITHUB_REPO. See README and .env.example.');
    return;
  }
  let data;
  try {
    data = await listDatasets();
  } catch (e) {
    showError(e.message || String(e));
    return;
  }
  if (!data.items?.length) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.innerHTML =
      `<p class="empty-state">No files in folder <strong>${escapeHtml(cfg.dataPath)}</strong>.</p>`;
    row.appendChild(td);
    tableBody.appendChild(row);
    return;
  }
  data.items.forEach((item) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost';
    btn.textContent = item.name;
    btn.addEventListener('click', async () => {
      clearError();
      try {
        const full = await fetchDatasetFile(item.path);
        renderPreview(full);
      } catch (e) {
        showError(e.message || String(e));
      }
    });
    nameTd.appendChild(btn);
    tr.appendChild(nameTd);
    const sizeTd = document.createElement('td');
    sizeTd.textContent = formatBytes(item.size);
    tr.appendChild(sizeTd);
    const shaTd = document.createElement('td');
    shaTd.textContent = item.sha?.slice(0, 7) ?? '';
    tr.appendChild(shaTd);
    tableBody.appendChild(tr);
  });
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

loadList();
