import {
  loadUserPrefs,
  saveUserPrefs,
  clearUserPrefs,
  formatBytes,
  datasetToTable,
} from './storage.js';
import {
  listDatasets,
  getDataset,
  setActiveDatasetId,
  getActiveDatasetId,
} from './dataset-store.js';
import { signIn, signUp, signOut, getSession, onAuthStateChange } from './auth.js';
import {
  computeColumnSummaries,
  SUMMARY_METRIC_KEYS,
  NA,
} from './column-stats.js';

const datasetListEl = document.getElementById('dataset-list');
const graphLink = document.getElementById('graph-link');
const noDatasetsMsg = document.getElementById('no-datasets-msg');
const statsHint = document.getElementById('stats-hint');

const authStatus = document.getElementById('auth-status');
const authSignedOut = document.getElementById('auth-signed-out');
const authSignedIn = document.getElementById('auth-signed-in');
const authEmail = document.getElementById('auth-email');
const authMsg = document.getElementById('auth-msg');
const signInForm = document.getElementById('sign-in-form');
const signUpForm = document.getElementById('sign-up-form');
const signOutBtn = document.getElementById('sign-out-btn');

let datasetCache = [];

function showAuthMsg(text, kind = 'ok') {
  if (!authMsg) return;
  authMsg.textContent = text;
  authMsg.className = `status-pill ${kind}`;
  authMsg.hidden = false;
  setTimeout(() => {
    authMsg.hidden = true;
  }, 4000);
}

function setAuthTab(tab) {
  document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
    const active = btn.dataset.authTab === tab;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  if (signInForm) signInForm.hidden = tab !== 'sign-in';
  if (signUpForm) signUpForm.hidden = tab !== 'sign-up';
}

document.querySelectorAll('[data-auth-tab]').forEach((btn) => {
  btn.addEventListener('click', () => setAuthTab(btn.dataset.authTab));
});

async function refreshAuthUI() {
  const session = await getSession();
  const cloud = Boolean(session?.user);

  if (cloud) {
    if (authSignedOut) authSignedOut.hidden = true;
    if (authSignedIn) authSignedIn.hidden = false;
    if (authEmail) authEmail.textContent = session.user.email ?? 'Account';
    if (authStatus) authStatus.textContent = 'Signed in — datasets sync to Supabase.';
  } else {
    if (authSignedOut) authSignedOut.hidden = false;
    if (authSignedIn) authSignedIn.hidden = true;
    if (authStatus) authStatus.textContent = 'Sign in to save datasets to your account (optional).';
  }

  refreshWelcome(session?.user?.email);
  await renderDatasetPicker();
}

signInForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('sign-in-email')?.value?.trim() ?? '';
  const password = document.getElementById('sign-in-password')?.value ?? '';
  try {
    await signIn(email, password);
    showAuthMsg('Signed in successfully.');
    signInForm.reset();
    await refreshAuthUI();
  } catch (err) {
    showAuthMsg(err.message || 'Sign in failed.', 'err');
  }
});

signUpForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('sign-up-email')?.value?.trim() ?? '';
  const password = document.getElementById('sign-up-password')?.value ?? '';
  const confirm = document.getElementById('sign-up-password-confirm')?.value ?? '';
  if (password !== confirm) {
    showAuthMsg('Passwords do not match.', 'err');
    return;
  }
  try {
    const { session } = await signUp(email, password);
    signUpForm.reset();
    if (session) {
      showAuthMsg('Account created and signed in.');
    } else {
      showAuthMsg('Account created. Check your email if confirmation is required, then sign in.', 'warn');
      setAuthTab('sign-in');
    }
    await refreshAuthUI();
  } catch (err) {
    showAuthMsg(err.message || 'Sign up failed.', 'err');
  }
});

signOutBtn?.addEventListener('click', async () => {
  try {
    await signOut();
    showAuthMsg('Signed out. Local-only datasets remain in this browser.');
    await refreshAuthUI();
  } catch (err) {
    showAuthMsg(err.message || 'Sign out failed.', 'err');
  }
});

async function renderDatasetPicker() {
  if (!datasetListEl) return;
  const activeId = getActiveDatasetId();

  let datasets;
  try {
    datasets = await listDatasets();
  } catch (err) {
    datasetListEl.innerHTML = `<p class="empty-state">${escapeHtml(err.message || 'Could not load datasets.')}</p>`;
    return;
  }

  datasetCache = datasets;

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
    const sourceTag = ds.source === 'cloud' ? ' · cloud' : ' · local';
    info.innerHTML = `<strong>${escapeHtml(ds.name)}</strong><span>${ds.columns?.length ?? 0} cols · ${ds.rowCount ?? 0} rows · ${size}${sourceTag}</span>`;

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

    toggleBtn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const open = statsWrap.hidden;
      if (open) {
        statsWrap.innerHTML = '<p class="empty-state">Loading summary…</p>';
        statsWrap.hidden = false;
        statsWrap.innerHTML = await buildStatsPanel(ds);
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
  } else if (activeId && !datasets.some((d) => d.id === activeId) && datasets[0]) {
    setActiveDatasetId(datasets[0].id);
  }

  updateGraphLink();
}

async function buildStatsPanel(ds) {
  let full = ds.text ? ds : await getDataset(ds.id);
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
  const ds = datasetCache.find((d) => d.id === id);
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

document.getElementById('user-form')?.addEventListener('submit', async (e) => {
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
  const session = await getSession();
  refreshWelcome(session?.user?.email);
});

document.getElementById('clear-btn')?.addEventListener('click', async () => {
  if (!confirm('Clear display name and notes only? (Datasets are kept.)')) return;
  clearUserPrefs();
  const nameInput = document.getElementById('display-name');
  const noteInput = document.getElementById('theme-note');
  if (nameInput) nameInput.value = '';
  if (noteInput) noteInput.value = '';
  const session = await getSession();
  refreshWelcome(session?.user?.email);
});

function refreshWelcome(accountEmail) {
  const data = loadUserPrefs();
  const welcome = document.getElementById('welcome-line');
  if (!welcome) return;

  if (accountEmail) {
    welcome.textContent = data.displayName
      ? `Welcome, ${data.displayName} (${accountEmail})`
      : `Signed in as ${accountEmail}`;
    return;
  }

  welcome.textContent = data.displayName
    ? `Local profile: ${data.displayName} (not signed in)`
    : 'Sign in below to sync datasets, or set a local display name.';
}

async function init() {
  const data = loadUserPrefs();
  const nameInput = document.getElementById('display-name');
  const noteInput = document.getElementById('theme-note');
  if (nameInput) nameInput.value = data.displayName;
  if (noteInput) noteInput.value = data.themeNote;

  setAuthTab('sign-in');
  await refreshAuthUI();

  onAuthStateChange(() => {
    refreshAuthUI();
  });
}

init();
