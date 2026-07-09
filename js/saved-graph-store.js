/**
 * Saved graphs in Supabase (requires signed-in user + cloud dataset).
 */

import { getSupabase } from './supabase-client.js';
import { getSession } from './auth.js';

function rowToGraph(row) {
  return {
    id: row.id,
    datasetId: row.dataset_id,
    userId: row.user_id,
    name: row.name,
    chartType: row.chart_type,
    config: row.config ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function canSaveGraphs() {
  const session = await getSession();
  return Boolean(session?.user);
}

export async function listSavedGraphs(datasetId) {
  const session = await getSession();
  if (!session?.user) return [];

  let query = getSupabase()
    .from('saved_graphs')
    .select('id, dataset_id, user_id, name, chart_type, config, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (datasetId) query = query.eq('dataset_id', datasetId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToGraph);
}

export async function listSavedGraphsByDatasetIds(datasetIds) {
  const session = await getSession();
  if (!session?.user || !datasetIds?.length) return [];

  const { data, error } = await getSupabase()
    .from('saved_graphs')
    .select('id, dataset_id, user_id, name, chart_type, config, created_at, updated_at')
    .in('dataset_id', datasetIds)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToGraph);
}

export async function getSavedGraph(id) {
  if (!id) return null;
  const session = await getSession();
  if (!session?.user) return null;

  const { data, error } = await getSupabase()
    .from('saved_graphs')
    .select('id, dataset_id, user_id, name, chart_type, config, created_at, updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? rowToGraph(data) : null;
}

export async function saveSavedGraph({ datasetId, name, chartType, config }) {
  const session = await getSession();
  if (!session?.user) {
    throw new Error('Sign in to save graphs to your account.');
  }

  const trimmed = String(name ?? '').trim();
  if (!trimmed) throw new Error('Graph name is required.');

  const { data, error } = await getSupabase()
    .from('saved_graphs')
    .insert({
      dataset_id: datasetId,
      user_id: session.user.id,
      name: trimmed,
      chart_type: chartType,
      config,
    })
    .select('id, dataset_id, user_id, name, chart_type, config, created_at, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return rowToGraph(data);
}

export async function deleteSavedGraph(id) {
  const session = await getSession();
  if (!session?.user) throw new Error('Sign in to delete saved graphs.');

  const { error } = await getSupabase().from('saved_graphs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
