-- ENUMS
create type task_type as enum ('summary', 'classification', 'extraction');
create type sla_tier as enum ('low_latency', 'low_cost', 'high_quality');
create type model_name as enum ('gpt_4_1', 'gpt_4_1_mini', 'rules_engine');
create type task_status as enum ('pending', 'running', 'completed', 'failed');
create type file_status as enum ('uploaded', 'processing', 'ready', 'failed');

-- FILES
create table if not exists uploaded_files (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  file_name text not null,
  file_type text not null,
  storage_path text not null,
  status file_status default 'uploaded',
  error_message text
);

-- TRANSCRIPTS
create table if not exists transcripts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  file_id uuid references uploaded_files(id) on delete cascade,
  text text,
  language text,
  duration_seconds integer,
  status file_status default 'processing',
  error_message text
);

-- TASKS + ROUTING
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  task_type task_type not null,
  sla sla_tier not null,
  input_text text not null,
  max_cost_cents integer not null,
  status task_status default 'pending',
  transcript_id uuid references transcripts(id),
  error_message text
);

create table if not exists routing_decisions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  task_id uuid references tasks(id) on delete cascade,
  chosen_model model_name not null,
  reason text,
  estimated_cost_cents integer,
  estimated_latency_ms integer
);

create table if not exists model_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  task_id uuid references tasks(id) on delete cascade,
  model model_name not null,
  token_input integer,
  token_output integer,
  latency_ms integer,
  cost_cents integer,
  success boolean,
  failure_reason text
);

-- RLS (minimal for POC)
alter table uploaded_files enable row level security;
alter table transcripts enable row level security;
alter table tasks enable row level security;
alter table routing_decisions enable row level security;
alter table model_runs enable row level security;

create policy "debug_all_uploaded" on uploaded_files
  for all using (true) with check (true);

create policy "debug_all_transcripts" on transcripts
  for all using (true) with check (true);

create policy "debug_all_tasks" on tasks
  for all using (true) with check (true);

create policy "debug_all_rout" on routing_decisions
  for all using (true) with check (true);

create policy "debug_all_runs" on model_runs
  for all using (true) with check (true);

alter table tasks
drop column if exists input_text;
