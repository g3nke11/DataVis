import {
  loadUserPrefs,
  saveUserPrefs,
  clearUserPrefs,
  listStoredDatasets,
  getStoredDataset,
  setActiveDatasetId,
  getActiveDatasetId,
  formatBytes,
  datasetToTable,
} from './storage.js';
import {
  computeColumnSummaries,
  SUMMARY_METRIC_KEYS,
  NA,
} from './column-stats.js';

const datasetListEl = document.getElementById('dataset-list');
const graphLink = document.getElementById('graph-link');
const noDatasetsMsg = document.getElementById('no-datasets-msg');
const statsHint = document.getElementById('stats-hint');

function renderDatasetPicker() {
  if (!datasetListEl) return;
  const activeId = getActiveDatasetId();
  const datasets = listStoredDatasets();

  if (!datasets.length) {
    datasetListEl.innerHTML = '';
    if (noDatasetsMsg) noDatasetsMsg.hidden = false;
    if (statsHint) statsHint.hidden = true;
    if (graphLink) {
      graphLink.classList.add('btn-disabled');
      graphLink.setAttribute('aria-disabled', 'true');
      graphLink.href = '#';
    }
    return;
  }

  if (noDatasetsMsg) noDatasetsMsg.hidden = true;
  if (statsHint) statsHint.hidden = false;
  datasetListEl.innerHTML = '';

  datasets.forEach((ds) => {
    const card = document.createElement('div');
    card.className = 'dataset-card';

    const label = document.createElement('label');
    label.className = 'dataset-option';

    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = 'active-dataset';
    radio.value = ds.id;
    radio.checked = ds.id === activeId;
    radio.addEventListener('change', () => {
      setActiveDatasetId(ds.id);
      updateGraphLink();
    });

    const info = document.createElement('span');
    info.className = 'dataset-option-info';
    const size = formatBytes(ds.text?.length ?? 0);
    info.innerHTML = `<strong>${escapeHtml(ds.name)}</strong><span>${ds.columns?.length ?? 0} cols · ${ds.rowCount ?? 0} rows · ${size}</span>`;

    label.appendChild(radio);
    label.appendChild(info);
    card.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'dataset-card-actions';
    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn btn-ghost btn-sm';
    toggleBtn.textContent = 'View column summary';
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-controls', `stats-${ds.id}`);

    const statsWrap = document.createElement('div');
    statsWrap.className = 'dataset-stats-wrap';
    statsWrap.id = `stats-${ds.id}`;
    statsWrap.hidden = true;

    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = statsWrap.hidden;
      if (open) {
        statsWrap.innerHTML = buildStatsPanel(ds);
        statsWrap.hidden = false;
        toggleBtn.textContent = 'Hide column summary';
        toggleBtn.setAttribute('aria-expanded', 'true');
      } else {
        statsWrap.hidden = true;
        statsWrap.innerHTML = '';
        toggleBtn.textContent = 'View column summary';
        toggleBtn.setAttribute('aria-expanded', 'false');
      }
    });

    actions.appendChild(toggleBtn);
    card.appendChild(actions);
    card.appendChild(statsWrap);
    datasetListEl.appendChild(card);
  });

  if (!activeId && datasets[0]) {
    setActiveDatasetId(datasets[0].id);
    const firstRadio = datasetListEl.querySelector('input[type="radio"]');
    if (firstRadio) firstRadio.checked = true;
  }

  updateGraphLink();
}

function buildStatsPanel(ds) {
  const full = getStoredDataset(ds.id);
  if (!full) {
    return '<p class="empty-state">Dataset not found.</p>';
  }

  let table;
  try {
    table = datasetToTable(full);
  } catch {
    return '<p class="empty-state">Could not parse dataset.</p>';
  }

  if (!table.headers.length) {
    return '<p class="empty-state">No columns in this dataset.</p>';
  }

  const summaries = computeColumnSummaries(table.headers, table.rows);
  const scroll = document.createElement('div');
  scroll.className = 'table-scroll';

  const tbl = document.createElement('table');
  tbl.className = 'list-table stats-summary-table';
  tbl.setAttribute('aria-label', `Column summary for ${ds.name}`);

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.innerHTML = '<th scope="col">Metric</th>';
  summaries.forEach((col) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = col.column;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  tbl.appendChild(thead);

  const tbody = document.createElement('tbody');
  SUMMARY_METRIC_KEYS.forEach((metricKey) => {
    const hasValue = summaries.some((col) => {
      const v = col.metrics[metricKey];
      return v != null && v !== NA;
    });
    if (!hasValue) return;

    const tr = document.createElement('tr');
    const metricTh = document.createElement('th');
    metricTh.scope = 'row';
    metricTh.textContent = metricKey;
    tr.appendChild(metricTh);

    summaries.forEach((col) => {
      const td = document.createElement('td');
      const val = col.metrics[metricKey] ?? NA;
      td.textContent = val;
      if (val === NA) td.classList.add('metric-na');
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  tbl.appendChild(tbody);
  scroll.appendChild(tbl);

  const host = document.createElement('div');
  host.appendChild(scroll);
  return host.innerHTML;
}

function updateGraphLink() {
  if (!graphLink) return;
  const id = getActiveDatasetId();
  const ds = id ? getStoredDataset(id) : null;
  if (ds) {
    graphLink.href = 'graph.html';
    graphLink.classList.remove('btn-disabled');
    graphLink.removeAttribute('aria-disabled');
    graphLink.textContent = `Graph “${ds.name}”`;
  } else {
    graphLink.href = '#';
    graphLink.classList.add('btn-disabled');
    graphLink.setAttribute('aria-disabled', 'true');
    graphLink.textContent = 'Open graph';
  }
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

document.getElementById('user-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const displayName = document.getElementById('display-name')?.value?.trim() ?? '';
  const themeNote = document.getElementById('theme-note')?.value ?? '';
  saveUserPrefs({ displayName, themeNote });
  const msg = document.getElementById('save-msg');
  if (msg) {
    msg.textContent = 'Saved locally in this browser.';
    msg.hidden = false;
    setTimeout(() => {
      msg.hidden = true;
    }, 2500);
  }
  refreshWelcome();
});

document.getElementById('clear-btn')?.addEventListener('click', () => {
  if (!confirm('Clear display name and notes only? (Datasets are kept.)')) return;
  clearUserPrefs();
  const nameInput = document.getElementById('display-name');
  const noteInput = document.getElementById('theme-note');
  if (nameInput) nameInput.value = '';
  if (noteInput) noteInput.value = '';
  refreshWelcome();
});

function refreshWelcome() {
  const data = loadUserPrefs();
  const welcome = document.getElementById('welcome-line');
  if (welcome) {
    welcome.textContent = data.displayName
      ? `Signed in locally as ${data.displayName}`
      : 'Set a display name below (stored only in this browser).';
  }
}

(function init() {
  const data = loadUserPrefs();
  const nameInput = document.getElementById('display-name');
  const noteInput = document.getElementById('theme-note');
  if (nameInput) nameInput.value = data.displayName;
  if (noteInput) noteInput.value = data.themeNote;
  refreshWelcome();
  renderDatasetPicker();
})();
