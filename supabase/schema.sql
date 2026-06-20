-- Compass schema. Run in Supabase SQL editor.
create extension if not exists vector;

create table if not exists advisors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text unique,
  role text not null check (role in ('advisor','team_lead','admin')),
  created_at timestamptz default now()
);

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owning_advisor_id uuid references advisors(id) on delete set null,
  profile jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists interactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references clients(id) on delete cascade,
  advisor_id uuid references advisors(id) on delete set null,
  raw_note text not null,
  summary text,
  commitments jsonb default '[]'::jsonb,
  sensitivities jsonb default '[]'::jsonb,
  relational jsonb default '[]'::jsonb,        -- behavioural signals (Compass's edge)
  topics jsonb default '[]'::jsonb,            -- powers gap detection
  partner_mentions jsonb default '[]'::jsonb,
  embedding vector(1536),
  created_at timestamptz default now()
);

create index if not exists interactions_client_idx on interactions(client_id);
create index if not exists interactions_embedding_idx
  on interactions using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists learning_content (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  topic text,
  body text,
  cpd_hours numeric default 0,
  embedding vector(1536)
);

create index if not exists learning_embedding_idx
  on learning_content using ivfflat (embedding vector_cosine_ops) with (lists = 100);

create table if not exists cpd_log (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid references advisors(id) on delete cascade,
  learning_content_id uuid references learning_content(id) on delete set null,
  hours numeric not null,
  completed_at timestamptz default now()
);

create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text,
  contact jsonb default '{}'::jsonb
);

create table if not exists audit_log (
  id uuid primary key default gen_random_uuid(),
  advisor_id uuid references advisors(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  action text not null,
  created_at timestamptz default now()
);

-- Row-level security: advisors see only their own clients.
alter table clients enable row level security;
alter table interactions enable row level security;

create policy if not exists clients_own on clients
  for select using (owning_advisor_id = auth.uid());
create policy if not exists interactions_own on interactions
  for select using (
    exists (select 1 from clients c where c.id = client_id and c.owning_advisor_id = auth.uid())
  );
