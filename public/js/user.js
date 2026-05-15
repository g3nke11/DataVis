const STORAGE_KEYS = {
  displayName: 'datavis_user_displayName',
  themeNote: 'datavis_user_note',
};

function load() {
  return {
    displayName: localStorage.getItem(STORAGE_KEYS.displayName) || '',
    themeNote: localStorage.getItem(STORAGE_KEYS.themeNote) || '',
  };
}

function save(data) {
  localStorage.setItem(STORAGE_KEYS.displayName, data.displayName);
  localStorage.setItem(STORAGE_KEYS.themeNote, data.themeNote);
}

document.getElementById('user-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const displayName = document.getElementById('display-name')?.value?.trim() ?? '';
  const themeNote = document.getElementById('theme-note')?.value ?? '';
  save({ displayName, themeNote });
  const msg = document.getElementById('save-msg');
  if (msg) {
    msg.textContent = 'Saved locally in this browser.';
    msg.hidden = false;
    setTimeout(() => {
      msg.hidden = true;
    }, 2500);
  }
});

document.getElementById('clear-btn')?.addEventListener('click', () => {
  localStorage.removeItem(STORAGE_KEYS.displayName);
  localStorage.removeItem(STORAGE_KEYS.themeNote);
  const nameInput = document.getElementById('display-name');
  const noteInput = document.getElementById('theme-note');
  if (nameInput) nameInput.value = '';
  if (noteInput) noteInput.value = '';
});

(function initFields() {
  const data = load();
  const nameInput = document.getElementById('display-name');
  const noteInput = document.getElementById('theme-note');
  const welcome = document.getElementById('welcome-line');
  if (nameInput) nameInput.value = data.displayName;
  if (noteInput) noteInput.value = data.themeNote;
  if (welcome) {
    welcome.textContent = data.displayName
      ? `Signed in locally as ${data.displayName}`
      : 'Set a display name below (stored only in your browser — no account server).';
  }
})();
