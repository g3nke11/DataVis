-- RLS for public.saved_graphs (run if not already applied).

alter table public.saved_graphs enable row level security;

create policy "Users select own saved graphs"
  on public.saved_graphs
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own saved graphs"
  on public.saved_graphs
  for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.datasets d
      where d.id = dataset_id and d.user_id = auth.uid()
    )
  );

create policy "Users update own saved graphs"
  on public.saved_graphs
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.datasets d
      where d.id = dataset_id and d.user_id = auth.uid()
    )
  );

create policy "Users delete own saved graphs"
  on public.saved_graphs
  for delete
  to authenticated
  using (auth.uid() = user_id);
