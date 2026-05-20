# Ledger — Multi-bank Personal Finance Tracker

A PIN-protected, multi-user personal bookkeeping app. Import statements from any bank, categorize transactions, add notes, and export clean PDF statements — all stored in Supabase.

## Features

- 🏦 **Multi-bank** — import from BCA, Mandiri, BRI, or any bank with a paste-able statement
- 📅 **Multi-month consolidation** — transactions from multiple banks in the same month are merged and sorted by date
- 👥 **Multi-user** — anyone with the PIN can access a workspace; create separate workspaces for different people
- ✏️ **Fully inline editable** — click any cell to edit date, description, category, type, amount, or note; saves instantly to Supabase
- 📊 **Rata-rata (monthly average)** — per-category YTD averages for budgeting
- 📄 **Filtered PDF export** — choose which months and categories to include/exclude
- 🔒 **PIN-protected workspaces** — 4–8 digit PIN, hashed with SHA-256

---

## Setup

### 1. Supabase

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the following:

```sql
-- Workspaces
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  pin_hash text not null,
  owner_label text,
  created_at timestamptz default now()
);

-- Categories
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
  month text not null,
  year int not null default 2026,
  date text not null,
  description text not null,
  type text not null check (type in ('DB','CR')),
  amount numeric not null,
  category_name text default 'Uncategorized',
  note text default '',
  created_at timestamptz default now()
);

-- RLS (open, app-level PIN gating)
alter table workspaces   enable row level security;
alter table categories   enable row level security;
alter table transactions enable row level security;

create policy "anon all workspaces"   on workspaces   for all using (true) with check (true);
create policy "anon all categories"   on categories   for all using (true) with check (true);
create policy "anon all transactions" on transactions for all using (true) with check (true);
```

3. Copy your **Project URL** and **anon public key** from Settings → API

### 2. Local development

```bash
git clone https://github.com/YOUR_USERNAME/ledger-app
cd ledger-app
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm install
npm run dev
```

### 3. Deploy to GitHub Pages / Vercel / Netlify

**Vercel (recommended — free):**
```bash
npm install -g vercel
vercel
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY as environment variables in Vercel dashboard
```

**GitHub Pages:**
```bash
# In vite.config.js, add: base: '/your-repo-name/'
npm run build
# Push dist/ to gh-pages branch, or use GitHub Actions
```

---

## Importing statements

1. Open your bank's internet banking or PDF statement
2. Select all text and copy
3. In Ledger, click **Import statement**
4. Paste the text, set bank name and account number
5. Click **Parse statement** — preview the detected transactions
6. Click **Import** to save

The parser detects BCA-format statements automatically (lines with `DD/MM ... AMOUNT DB/CR`). For other banks, the same format works as long as amounts are followed by `DB` or `CR`.

---

## Exporting PDF

Click **Export PDF** (top right) to open the export dialog:
- **Select months** — toggle which months to include
- **Hide categories** — exclude categories from the PDF (e.g. hide internal transfers)
- PDF includes: monthly summary, category breakdown with rata-rata, and full transaction detail

---

## Workspace & PIN

- Each workspace is completely isolated
- Share your PIN with collaborators to give them access
- Create separate workspaces for different people or purposes
- PIN is hashed with SHA-256 before storage — Supabase never sees the raw PIN
