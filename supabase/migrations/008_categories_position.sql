-- Position for category ordering across admin/menu/filters
alter table if exists public.categories
  add column if not exists position integer;

update public.categories
set position = coalesce(position, sort_order, 0);

alter table if exists public.categories
  alter column position set default 0;

create index if not exists idx_categories_position
  on public.categories(position asc);

