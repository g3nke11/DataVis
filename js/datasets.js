import {
  listDatasets,
  getDataset,
  saveDataset,
  deleteDataset,
  isCloudSyncEnabled,
} from './dataset-store.js';
import { datasetToTable, formatBytes } from './storage.js';
import { onAuthStateChange } from './auth.js';

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
const uploadSubmitBtn = document.getElementById('upload-submit-btn');
const authNote = document.getElementById('datasets-auth-note');

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

async function refreshAuthNote() {
  const cloud = await isCloudSyncEnabled();
  if (authNote) authNote.hidden = cloud;
  if (uploadSubmitBtn) {
    uploadSubmitBtn.textContent = cloud ? 'Upload to account' : 'Save to browser';
  }
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
    const src = dataset.source === 'cloud' ? 'cloud' : 'local';
    metaEl.textContent = `${dataset.columns?.length ?? 0} columns · ${dataset.rowCount ?? 0} rows · ${formatBytes(dataset.text?.length ?? 0)} · ${src}`;
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

async function renderList() {
  clearBanners();
  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="4"><p class="empty-state">Loading…</p></td></tr>';

  let items;
  try {
    items = await listDatasets();
  } catch (err) {
    tableBody.innerHTML = '';
    showError(err.message || 'Could not load datasets.');
    return;
  }

  tableBody.innerHTML = '';

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
    btn.addEventListener('click', async () => {
      clearBanners();
      try {
        const full = await getDataset(item.id);
        renderPreview(full);
      } catch (err) {
        showError(err.message || 'Could not load dataset.');
      }
    });
    nameTd.appendChild(btn);
    if (item.source === 'cloud') {
      const tag = document.createElement('span');
      tag.className = 'source-tag';
      tag.textContent = 'cloud';
      nameTd.appendChild(tag);
    }
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
    delBtn.addEventListener('click', async () => {
      const where = item.source === 'cloud' ? 'your account' : 'this browser';
      if (!confirm(`Delete "${item.name}" from ${where}?`)) return;
      try {
        await deleteDataset(item.id);
        await renderList();
        previewTitle.textContent = 'Preview';
        if (metaEl) metaEl.textContent = '\u00a0';
        jsonPre.hidden = true;
        csvWrap.hidden = true;
        rawNote.hidden = true;
      } catch (err) {
        showError(err.message || 'Delete failed.');
      }
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
    showError('File is too large (max ~4 MB).');
    return;
  }

  const cloud = await isCloudSyncEnabled();
  if (uploadSubmitBtn) uploadSubmitBtn.disabled = true;

  try {
    const text = await file.text();
    const saved = await saveDataset({ name: file.name, text, mime: file.type });
    const dest = saved.source === 'cloud' ? 'your account' : 'this browser';
    showSuccess(`Saved "${saved.name}" to ${dest} (${saved.rowCount} rows).`);
    if (fileInput) fileInput.value = '';
    await renderList();
    renderPreview(saved);
  } catch (err) {
    showError(err.message || String(err));
  } finally {
    if (uploadSubmitBtn) uploadSubmitBtn.disabled = false;
  }
});

async function init() {
  await refreshAuthNote();
  await renderList();
  onAuthStateChange(async () => {
    await refreshAuthNote();
    await renderList();
  });
}

init();
