-- SQL Phase PR-2: Supabase schema + retention automation

create table if not exists public.orderflow_trades (
  id bigserial primary key,
  ts timestamptz not null,
  symbol text not null,
  exchange text not null default 'binance',
  trade_id text not null,
  side text not null check (side in ('buy', 'sell')),
  price double precision not null,
  qty double precision not null,
  created_at timestamptz not null default now(),
  unique (symbol, exchange, trade_id)
);

create index if not exists orderflow_trades_symbol_ts_idx
  on public.orderflow_trades (symbol, ts desc);

create index if not exists orderflow_trades_ts_idx
  on public.orderflow_trades (ts desc);

create table if not exists public.model_cache (
  key text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz null
);

create index if not exists model_cache_expires_at_idx
  on public.model_cache (expires_at);

create table if not exists public.retention_runs (
  id bigserial primary key,
  ran_at timestamptz not null default now(),
  orderflow_deleted int not null default 0,
  cache_deleted int not null default 0,
  retention_hours int not null,
  batch_size int not null,
  status text not null default 'ok',
  error text null
);

alter table public.orderflow_trades enable row level security;
alter table public.model_cache enable row level security;
alter table public.retention_runs enable row level security;

-- RLS is enabled; service role bypasses RLS for scheduled maintenance jobs.

create or replace function public.prune_analytics(
  retention_hours int default 24,
  model_cache_retention_hours int default 168,
  batch_size int default 50000
)
returns table(orderflow_deleted int, cache_deleted int)
language plpgsql
security definer
as $$
declare
  cutoff timestamptz;
  cache_cutoff timestamptz;
begin
  cutoff := now() - (retention_hours || ' hours')::interval;
  cache_cutoff := now() - (model_cache_retention_hours || ' hours')::interval;

  with to_delete as (
    select id
    from public.orderflow_trades
    where ts < cutoff
    order by ts asc
    limit batch_size
  ),
  deleted as (
    delete from public.orderflow_trades
    where id in (select id from to_delete)
    returning id
  )
  select count(*) into orderflow_deleted from deleted;

  with cache_to_delete as (
    select key
    from public.model_cache
    where (expires_at is not null and expires_at < now())
      or (expires_at is null and created_at < cache_cutoff)
    order by coalesce(expires_at, created_at) asc
    limit batch_size
  ),
  cache_deleted_rows as (
    delete from public.model_cache
    where key in (select key from cache_to_delete)
    returning key
  )
  select count(*) into cache_deleted from cache_deleted_rows;

  return query select orderflow_deleted, cache_deleted;
end;
$$;
