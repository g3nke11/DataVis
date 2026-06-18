/**
 * Dataset catalog: Supabase when signed in, localStorage otherwise.
 */

import { getSupabase } from './supabase-client.js';
import { getSession } from './auth.js';
import {
  listStoredDatasets,
  getStoredDataset,
  saveStoredDataset,
  deleteStoredDataset,
  setActiveDatasetId,
  getActiveDatasetId,
  datasetToTable,
} from './storage.js';

function rowToEntry(row) {
  const raw = row.raw_data ?? {};
  const text = typeof raw.text === 'string' ? raw.text : '';
  const name = row.file_name;
  const mime = raw.mime || guessMime(name);
  let columns = raw.columns;
  let rowCount = raw.rowCount;

  if (!columns || rowCount == null) {
    try {
      const table = datasetToTable({ name, text, mime });
      columns = table.headers;
      rowCount = table.rows.length;
    } catch {
      columns = columns ?? [];
      rowCount = rowCount ?? 0;
    }
  }

  return {
    id: row.id,
    name,
    mime,
    text,
    uploadedAt: row.uploaded_at,
    rowCount,
    columns,
    source: 'cloud',
  };
}

function guessMime(name) {
  const lower = name.toLowerCase();
  if (lower.endsWith('.json')) return 'application/json';
  if (lower.endsWith('.csv')) return 'text/csv';
  return 'text/plain';
}

export async function isCloudSyncEnabled() {
  const session = await getSession();
  return Boolean(session?.user);
}

export async function listDatasets() {
  const session = await getSession();
  if (!session?.user) return listStoredDatasets().map((d) => ({ ...d, source: 'local' }));

  const { data, error } = await getSupabase()
    .from('datasets')
    .select('id, file_name, file_size_bytes, uploaded_at, raw_data')
    .order('uploaded_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToEntry);
}

export async function getDataset(id) {
  if (!id) return null;

  const session = await getSession();
  if (!session?.user) {
    const local = getStoredDataset(id);
    return local ? { ...local, source: 'local' } : null;
  }

  const { data, error } = await getSupabase()
    .from('datasets')
    .select('id, file_name, file_size_bytes, uploaded_at, raw_data')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToEntry(data) : null;
}

export async function saveDataset({ name, text, mime }) {
  const session = await getSession();
  if (!session?.user) {
    const entry = saveStoredDataset({ name, text, mime });
    return { ...entry, source: 'local' };
  }

  const table = datasetToTable({ name, text, mime: mime || guessMime(name) });
  const raw_data = {
    mime: mime || guessMime(name),
    text,
    columns: table.headers,
    rowCount: table.rows.length,
  };

  const { data, error } = await getSupabase()
    .from('datasets')
    .insert({
      user_id: session.user.id,
      file_name: name,
      file_size_bytes: text.length,
      raw_data,
    })
    .select('id, file_name, file_size_bytes, uploaded_at, raw_data')
    .single();

  if (error) throw new Error(error.message);
  return rowToEntry(data);
}

export async function deleteDataset(id) {
  const session = await getSession();
  if (!session?.user) {
    deleteStoredDataset(id);
    return;
  }

  const { error } = await getSupabase().from('datasets').delete().eq('id', id);
  if (error) throw new Error(error.message);

  if (getActiveDatasetId() === id) setActiveDatasetId(null);
}

export { setActiveDatasetId, getActiveDatasetId };

export async function getActiveDataset() {
  const id = getActiveDatasetId();
  return id ? getDataset(id) : null;
}
