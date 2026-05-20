import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Supabase SQL schema (run once in Supabase SQL editor) ─────────────────────
// Paste this into your Supabase dashboard > SQL Editor:
/*
-- Workspaces (one per user/team, protected by PIN)
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,         -- bcrypt hash of 6-digit PIN
  owner_label text,               -- e.g. "Mie Joeng Harding"
  created_at timestamptz default now()
);

-- Categories per workspace
create table categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  name text not null,
  color text default '#888888'
);

-- Transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  bank_name text not null,
  account_no text,
  month text not null,            -- "Jan", "Feb", ...
  year int not null default 2026,
  date text not null,             -- "DD/MM"
  description text not null,
  type text not null check (type in ('DB','CR')),
  amount numeric not null,
  category_name text default 'Uncategorized',
  note text default '',
  created_at timestamptz default now()
);

-- Enable RLS
alter table workspaces   enable row level security;
alter table categories   enable row level security;
alter table transactions enable row level security;

-- Open read/write for anon (PIN-gated at app level)
create policy "anon all workspaces"   on workspaces   for all using (true) with check (true);
create policy "anon all categories"   on categories   for all using (true) with check (true);
create policy "anon all transactions" on transactions for all using (true) with check (true);
*/
