/**
 * Thin client for backend GitHub proxy.
 */

export async function fetchConfig() {
  const res = await fetch('/api/config');
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listDatasets() {
  const res = await fetch('/api/datasets');
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || res.statusText);
  }
  return res.json();
}

export async function fetchDatasetFile(repoPath) {
  const qs = new URLSearchParams({ path: repoPath });
  const res = await fetch(`/api/datasets/raw?${qs}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.message || res.statusText);
  }
  return body;
}
