import {
  loadUserPrefs,
  saveUserPrefs,
  clearUserPrefs,
  listStoredDatasets,
  getStoredDataset,
  setActiveDatasetId,
  getActiveDatasetId,
  formatBytes,
} from './storage.js';

const datasetListEl = document.getElementById('dataset-list');
const graphLink = document.getElementById('graph-link');
const noDatasetsMsg = document.getElementById('no-datasets-msg');

function renderDatasetPicker() {
  if (!datasetListEl) return;
  const activeId = getActiveDatasetId();
  const datasets = listStoredDatasets();

  if (!datasets.length) {
    datasetListEl.innerHTML = '';
    if (noDatasetsMsg) noDatasetsMsg.hidden = false;
    if (graphLink) {
      graphLink.classList.add('btn-disabled');
      graphLink.setAttribute('aria-disabled', 'true');
      graphLink.href = '#';
    }
    return;
  }

  if (noDatasetsMsg) noDatasetsMsg.hidden = true;
  datasetListEl.innerHTML = '';

  datasets.forEach((ds) => {
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
    datasetListEl.appendChild(label);
  });

  if (!activeId && datasets[0]) {
    setActiveDatasetId(datasets[0].id);
    const firstRadio = datasetListEl.querySelector('input[type="radio"]');
    if (firstRadio) firstRadio.checked = true;
  }

  updateGraphLink();
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
