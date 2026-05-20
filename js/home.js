import { listStoredDatasets } from './storage.js';

const el = document.getElementById('storage-status');
if (el) {
  const count = listStoredDatasets().length;
  el.textContent =
    count === 0
      ? 'No datasets saved yet — upload on the datasets page.'
      : `${count} dataset${count === 1 ? '' : 's'} in browser storage`;
}
