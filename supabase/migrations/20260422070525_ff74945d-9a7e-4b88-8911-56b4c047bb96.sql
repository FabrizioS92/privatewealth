create table if not exists public.etf_geo_breakdown (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  isin text not null,
  region text not null check (region in ('north_america','europe_developed','asia_developed','emerging_markets','other')),
  weight numeric not null check (weight >= 0 and weight <= 100),
  source text not null default 'manual' check (source in ('justetf','manual')),
  fetched_at timestamptz not null default now(),
  unique (user_id, isin, region)
);

alter table public.etf_geo_breakdown enable row level security;

create policy "Users view own etf geo" on public.etf_geo_breakdown
  for select using (auth.uid() = user_id);

create policy "Users insert own etf geo" on public.etf_geo_breakdown
  for insert with check (auth.uid() = user_id);

create policy "Users update own etf geo" on public.etf_geo_breakdown
  for update using (auth.uid() = user_id);

create policy "Users delete own etf geo" on public.etf_geo_breakdown
  for delete using (auth.uid() = user_id);

create index if not exists etf_geo_breakdown_user_isin_idx
  on public.etf_geo_breakdown (user_id, isin);