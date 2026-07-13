-- ============================================
-- 046: CRM MODULE (inspired by Twenty CRM)
-- Sales pipeline (deals on a kanban), companies (B2B),
-- tasks/follow-ups, and a unified activity timeline.
-- Extends the existing customers module (006_customers.sql):
-- deals, tasks and activities all reference public.customers.
-- ============================================

-- ─── COMPANIES (B2B organizations) ───────────
create table if not exists public.crm_companies (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null,
  domain               text,
  industry             text,
  employee_count       integer check (employee_count is null or employee_count >= 0),
  annual_revenue_cents bigint check (annual_revenue_cents is null or annual_revenue_cents >= 0),
  phone                text,
  email                text,
  city                 text,
  state                text,
  country              text not null default 'México',
  address              text,
  website              text,
  linkedin_url         text,
  tax_id               text, -- RFC MX
  notes                text,
  tags                 text[] not null default '{}',
  owner_id             uuid references auth.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_crm_companies_name on public.crm_companies(lower(name));
create index if not exists idx_crm_companies_owner on public.crm_companies(owner_id);
create index if not exists idx_crm_companies_created on public.crm_companies(created_at desc);
create index if not exists idx_crm_companies_tags on public.crm_companies using gin(tags);

-- Link a customer (person) to a company
alter table public.customers
  add column if not exists crm_company_id uuid references public.crm_companies(id) on delete set null;
create index if not exists idx_customers_crm_company on public.customers(crm_company_id);

-- ─── PIPELINES ───────────────────────────────
create table if not exists public.crm_pipelines (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  is_default   boolean not null default false,
  position     integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Only one default pipeline
create unique index if not exists idx_crm_pipelines_default
  on public.crm_pipelines(is_default) where is_default = true;

-- ─── STAGES (kanban columns) ─────────────────
create table if not exists public.crm_stages (
  id               uuid primary key default gen_random_uuid(),
  pipeline_id      uuid not null references public.crm_pipelines(id) on delete cascade,
  name             text not null,
  color            text not null default '#6B7280',
  position         integer not null default 0,
  stage_type       text not null default 'open'
                    check (stage_type in ('open', 'won', 'lost')),
  win_probability  integer not null default 0
                    check (win_probability between 0 and 100),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_crm_stages_pipeline on public.crm_stages(pipeline_id, position);

-- ─── DEALS / OPPORTUNITIES ───────────────────
create table if not exists public.crm_deals (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null,
  description           text,
  pipeline_id           uuid not null references public.crm_pipelines(id) on delete restrict,
  stage_id              uuid not null references public.crm_stages(id) on delete restrict,
  customer_id           uuid references public.customers(id) on delete set null,
  company_id            uuid references public.crm_companies(id) on delete set null,
  amount_cents          bigint not null default 0 check (amount_cents >= 0),
  currency              text not null default 'MXN',
  probability           integer check (probability is null or probability between 0 and 100),
  status                text not null default 'open'
                         check (status in ('open', 'won', 'lost')),
  expected_close_date   date,
  closed_at             timestamptz,
  lost_reason           text,
  source                text not null default 'admin'
                         check (source in ('web', 'admin', 'import', 'whatsapp', 'referral', 'social', 'pos', 'marketplace', 'other')),
  owner_id              uuid references auth.users(id) on delete set null,
  position              integer not null default 0, -- order within its stage (kanban)
  tags                  text[] not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists idx_crm_deals_pipeline on public.crm_deals(pipeline_id);
create index if not exists idx_crm_deals_stage on public.crm_deals(stage_id, position);
create index if not exists idx_crm_deals_customer on public.crm_deals(customer_id);
create index if not exists idx_crm_deals_company on public.crm_deals(company_id);
create index if not exists idx_crm_deals_status on public.crm_deals(status);
create index if not exists idx_crm_deals_owner on public.crm_deals(owner_id);
create index if not exists idx_crm_deals_close_date on public.crm_deals(expected_close_date) where status = 'open';
create index if not exists idx_crm_deals_created on public.crm_deals(created_at desc);

-- ─── TASKS / FOLLOW-UPS ──────────────────────
create table if not exists public.crm_tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        text not null default 'todo'
                 check (status in ('todo', 'in_progress', 'done')),
  priority      text not null default 'medium'
                 check (priority in ('low', 'medium', 'high', 'urgent')),
  due_at        timestamptz,
  completed_at  timestamptz,
  assignee_id   uuid references auth.users(id) on delete set null,
  deal_id       uuid references public.crm_deals(id) on delete cascade,
  customer_id   uuid references public.customers(id) on delete cascade,
  company_id    uuid references public.crm_companies(id) on delete cascade,
  created_by    uuid references auth.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_crm_tasks_status on public.crm_tasks(status);
create index if not exists idx_crm_tasks_due on public.crm_tasks(due_at) where status <> 'done';
create index if not exists idx_crm_tasks_deal on public.crm_tasks(deal_id);
create index if not exists idx_crm_tasks_customer on public.crm_tasks(customer_id);
create index if not exists idx_crm_tasks_company on public.crm_tasks(company_id);
create index if not exists idx_crm_tasks_assignee on public.crm_tasks(assignee_id);

-- ─── ACTIVITY TIMELINE ───────────────────────
create table if not exists public.crm_activities (
  id             uuid primary key default gen_random_uuid(),
  activity_type  text not null, -- deal_created, stage_changed, deal_won, deal_lost,
                                 -- deal_reopened, task_created, task_completed,
                                 -- note, call, email, whatsapp, meeting, company_created
  deal_id        uuid references public.crm_deals(id) on delete cascade,
  customer_id    uuid references public.customers(id) on delete cascade,
  company_id     uuid references public.crm_companies(id) on delete cascade,
  task_id        uuid references public.crm_tasks(id) on delete set null,
  actor_id       uuid references auth.users(id) on delete set null,
  body           text,
  payload        jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists idx_crm_activities_deal on public.crm_activities(deal_id, created_at desc);
create index if not exists idx_crm_activities_customer on public.crm_activities(customer_id, created_at desc);
create index if not exists idx_crm_activities_company on public.crm_activities(company_id, created_at desc);
create index if not exists idx_crm_activities_type on public.crm_activities(activity_type);

-- ─── UPDATED_AT TRIGGERS ─────────────────────
drop trigger if exists set_crm_companies_updated_at on public.crm_companies;
create trigger set_crm_companies_updated_at before update on public.crm_companies
  for each row execute function public.handle_updated_at();

drop trigger if exists set_crm_pipelines_updated_at on public.crm_pipelines;
create trigger set_crm_pipelines_updated_at before update on public.crm_pipelines
  for each row execute function public.handle_updated_at();

drop trigger if exists set_crm_stages_updated_at on public.crm_stages;
create trigger set_crm_stages_updated_at before update on public.crm_stages
  for each row execute function public.handle_updated_at();

drop trigger if exists set_crm_deals_updated_at on public.crm_deals;
create trigger set_crm_deals_updated_at before update on public.crm_deals
  for each row execute function public.handle_updated_at();

drop trigger if exists set_crm_tasks_updated_at on public.crm_tasks;
create trigger set_crm_tasks_updated_at before update on public.crm_tasks
  for each row execute function public.handle_updated_at();

-- ─── DEAL CLOSE-STATE SYNC ───────────────────
-- Keep closed_at/probability consistent with status transitions so the
-- API layer never has to remember to set them.
create or replace function public.crm_sync_deal_close_state()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'won' then
      new.closed_at := coalesce(new.closed_at, now());
      new.probability := 100;
    elsif new.status = 'lost' then
      new.closed_at := coalesce(new.closed_at, now());
      new.probability := 0;
    else -- reopened
      new.closed_at := null;
      new.lost_reason := null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_crm_deals_close_state on public.crm_deals;
create trigger trg_crm_deals_close_state before update on public.crm_deals
  for each row execute function public.crm_sync_deal_close_state();

-- ─── TASK COMPLETION SYNC ────────────────────
create or replace function public.crm_sync_task_completed()
returns trigger as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'done' then
      new.completed_at := coalesce(new.completed_at, now());
    else
      new.completed_at := null;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_crm_tasks_completed on public.crm_tasks;
create trigger trg_crm_tasks_completed before update on public.crm_tasks
  for each row execute function public.crm_sync_task_completed();

-- ─── ROW LEVEL SECURITY (admin only) ─────────
alter table public.crm_companies  enable row level security;
alter table public.crm_pipelines  enable row level security;
alter table public.crm_stages     enable row level security;
alter table public.crm_deals      enable row level security;
alter table public.crm_tasks      enable row level security;
alter table public.crm_activities enable row level security;

drop policy if exists "CRM companies: admin all" on public.crm_companies;
create policy "CRM companies: admin all" on public.crm_companies
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "CRM pipelines: admin all" on public.crm_pipelines;
create policy "CRM pipelines: admin all" on public.crm_pipelines
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "CRM stages: admin all" on public.crm_stages;
create policy "CRM stages: admin all" on public.crm_stages
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "CRM deals: admin all" on public.crm_deals;
create policy "CRM deals: admin all" on public.crm_deals
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "CRM tasks: admin all" on public.crm_tasks;
create policy "CRM tasks: admin all" on public.crm_tasks
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "CRM activities: admin all" on public.crm_activities;
create policy "CRM activities: admin all" on public.crm_activities
  for all using (public.is_admin()) with check (public.is_admin());

-- ─── SEED: default "Ventas" pipeline + stages ─
do $$
declare
  v_pipeline_id uuid;
begin
  if not exists (select 1 from public.crm_pipelines where is_default) then
    insert into public.crm_pipelines (name, description, is_default, position)
    values ('Ventas', 'Pipeline de ventas principal', true, 0)
    returning id into v_pipeline_id;

    insert into public.crm_stages (pipeline_id, name, color, position, stage_type, win_probability)
    values
      (v_pipeline_id, 'Prospecto',    '#94A3B8', 0, 'open', 10),
      (v_pipeline_id, 'Contactado',   '#38BDF8', 1, 'open', 25),
      (v_pipeline_id, 'Propuesta',    '#818CF8', 2, 'open', 50),
      (v_pipeline_id, 'Negociación',  '#FBBF24', 3, 'open', 75),
      (v_pipeline_id, 'Ganado',       '#22C55E', 4, 'won', 100),
      (v_pipeline_id, 'Perdido',      '#EF4444', 5, 'lost', 0);
  end if;
end $$;
