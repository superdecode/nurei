-- Performance analytics tables for web vitals and load error tracking

create table if not exists page_performance_events (
  id          bigserial primary key,
  metric_name text        not null,  -- LCP, CLS, INP, FCP, TTFB
  metric_value numeric(10,3) not null,
  rating      text        not null check (rating in ('good','needs-improvement','poor')),
  page_path   text        not null,
  session_id  text,
  user_agent  text,
  connection  text,
  created_at  timestamptz not null default now()
);

create table if not exists page_load_errors (
  id          bigserial primary key,
  error_type  text        not null,  -- resource, js, network, render
  error_msg   text        not null,
  source_url  text,
  page_path   text        not null,
  stack       text,
  session_id  text,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Indexes for admin queries
create index if not exists idx_ppe_metric_created  on page_performance_events (metric_name, created_at desc);
create index if not exists idx_ppe_path_created    on page_performance_events (page_path, created_at desc);
create index if not exists idx_ple_type_created    on page_load_errors (error_type, created_at desc);
create index if not exists idx_ple_path_created    on page_load_errors (page_path, created_at desc);

-- Public insert, no read (admin reads via service role)
alter table page_performance_events enable row level security;
alter table page_load_errors        enable row level security;

create policy "public_insert_vitals" on page_performance_events
  for insert to anon, authenticated with check (true);

create policy "public_insert_errors" on page_load_errors
  for insert to anon, authenticated with check (true);
