import {
  listStoredDatasets,
  getStoredDataset,
  saveStoredDataset,
  deleteStoredDataset,
  datasetToTable,
  formatBytes,
} from './storage.js';

const tableBody = document.querySelector('#local-datasets-table tbody');
const errorBanner = document.getElementById('datasets-error');
const successBanner = document.getElementById('datasets-success');
const metaEl = document.getElementById('dataset-meta');
const previewTitle = document.getElementById('preview-title');
const jsonPre = document.getElementById('json-preview');
const csvWrap = document.getElementById('csv-preview');
const rawNote = document.getElementById('raw-note');
const uploadForm = document.getElementById('upload-form');
const fileInput = document.getElementById('dataset-file');

function showError(msg) {
  if (!errorBanner) return;
  errorBanner.textContent = msg;
  errorBanner.hidden = false;
  if (successBanner) successBanner.hidden = true;
}

function showSuccess(msg) {
  if (!successBanner) return;
  successBanner.textContent = msg;
  successBanner.hidden = false;
  if (errorBanner) errorBanner.hidden = true;
}

function clearBanners() {
  if (errorBanner) errorBanner.hidden = true;
  if (successBanner) successBanner.hidden = true;
}

function renderCsvTable(rows) {
  if (!csvWrap) return;
  csvWrap.innerHTML = '';
  if (!rows.length) {
    csvWrap.textContent = 'Empty table.';
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
  const headers = rows[0];
  rows.slice(1).forEach((line) => {
    const tr = document.createElement('tr');
    headers.forEach((_c, idx) => {
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
    metaEl.textContent = `${dataset.columns?.length ?? 0} columns · ${dataset.rowCount ?? 0} rows · ${formatBytes(dataset.text.length)}`;
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
      rawNote.textContent = 'Invalid JSON; showing raw text.';
      jsonPre.textContent = dataset.text;
      jsonPre.hidden = false;
    }
    return;
  }

  if (lower.endsWith('.csv')) {
    const table = datasetToTable(dataset);
    csvWrap.hidden = false;
    renderCsvTable([table.headers, ...table.rows]);
    return;
  }

  rawNote.hidden = false;
  rawNote.textContent = 'Raw text preview.';
  jsonPre.textContent = dataset.text;
  jsonPre.hidden = false;
}

function renderLocalList() {
  clearBanners();
  if (!tableBody) return;
  tableBody.innerHTML = '';
  const items = listStoredDatasets();

  if (!items.length) {
    const row = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 4;
    td.innerHTML = '<p class="empty-state">No datasets yet. Upload a CSV or JSON file above.</p>';
    row.appendChild(td);
    tableBody.appendChild(row);
    return;
  }

  items.forEach((item) => {
    const tr = document.createElement('tr');
    const nameTd = document.createElement('td');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-ghost';
    btn.textContent = item.name;
    btn.addEventListener('click', () => {
      clearBanners();
      renderPreview(getStoredDataset(item.id));
    });
    nameTd.appendChild(btn);
    tr.appendChild(nameTd);

    const colsTd = document.createElement('td');
    colsTd.textContent = String(item.columns?.length ?? 0);
    tr.appendChild(colsTd);

    const rowsTd = document.createElement('td');
    rowsTd.textContent = String(item.rowCount ?? 0);
    tr.appendChild(rowsTd);

    const actionsTd = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn-ghost btn-danger-text';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => {
      if (!confirm(`Delete "${item.name}" from this browser?`)) return;
      deleteStoredDataset(item.id);
      renderLocalList();
      previewTitle.textContent = 'Preview';
      if (metaEl) metaEl.textContent = '\u00a0';
      jsonPre.hidden = true;
      csvWrap.hidden = true;
      rawNote.hidden = true;
    });
    actionsTd.appendChild(delBtn);
    tr.appendChild(actionsTd);
    tableBody.appendChild(tr);
  });
}

uploadForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearBanners();
  const file = fileInput?.files?.[0];
  if (!file) {
    showError('Choose a CSV or JSON file to upload.');
    return;
  }
  const lower = file.name.toLowerCase();
  if (!lower.endsWith('.csv') && !lower.endsWith('.json')) {
    showError('Only .csv and .json files are supported.');
    return;
  }
  if (file.size > 4 * 1024 * 1024) {
    showError('File is too large for browser storage (max ~4 MB).');
    return;
  }
  try {
    const text = await file.text();
    const saved = saveStoredDataset({ name: file.name, text, mime: file.type });
    showSuccess(`Saved "${saved.name}" locally (${saved.rowCount} rows).`);
    if (fileInput) fileInput.value = '';
    renderLocalList();
    renderPreview(saved);
  } catch (err) {
    showError(err.message || String(err));
  }
});

renderLocalList();
