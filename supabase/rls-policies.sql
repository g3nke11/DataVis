-- Run in Supabase SQL Editor after creating public.datasets.
-- Ensures each user can only read/write their own rows.

alter table public.datasets enable row level security;

create policy "Users select own datasets"
  on public.datasets
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users insert own datasets"
  on public.datasets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users update own datasets"
  on public.datasets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users delete own datasets"
  on public.datasets
  for delete
  to authenticated
  using (auth.uid() = user_id);
