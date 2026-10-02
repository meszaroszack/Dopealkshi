create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text unique not null,
  expires_at timestamptz not null
);

create table if not exists profiles (
  id uuid primary key references users(id) on delete cascade,
  role text not null default 'user',
  tier text not null default 'free',
  disabled boolean not null default false,
  free_markets_used integer not null default 0,
  skip_windows integer not null default 0,
  bonus_market_granted boolean not null default false
);

create table if not exists kalshi_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  environment text not null check (environment in ('demo', 'live')),
  api_key_id text not null,
  private_key_encrypted text not null,
  last_balance numeric,
  last_error text,
  checklist jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (user_id, environment)
);

create table if not exists agents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null,
  strategy text not null default 'btc_15m',
  style text not null default 'window',
  params jsonb not null,
  mode text not null default 'paper',
  status text not null default 'paused',
  armed boolean not null default false,
  published boolean not null default false,
  last_ticker text,
  window_entries integer not null default 0,
  open_entry_price numeric,
  open_count numeric,
  lease_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists order_intents (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid references agents(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  client_order_id text unique not null,
  ticker text not null,
  side text not null,
  price text not null,
  count text not null,
  status text not null,
  kalshi_order_id text,
  submit_time timestamptz not null default now(),
  last_error text,
  purpose text not null default 'strategy',
  raw jsonb
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null references agents(id) on delete cascade,
  action text not null,
  sentence text not null,
  created_at timestamptz not null default now()
);

create table if not exists app_settings (
  id integer primary key default 1,
  halt_live boolean not null default false
);

insert into app_settings (id, halt_live) values (1, false)
on conflict (id) do nothing;

create table if not exists paper_orders (
  client_order_id text primary key,
  order_id text not null,
  user_id uuid not null,
  ticker text not null,
  side text not null,
  price text not null,
  count text not null,
  fill_count text not null,
  remaining_count text not null,
  status text not null,
  visible_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists admin_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target text,
  created_at timestamptz not null default now()
);
