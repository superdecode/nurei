alter table public.products
  add column if not exists display_order integer;

with ranked as (
  select id, row_number() over (order by created_at asc, id asc) - 1 as next_order
  from public.products
)
update public.products p
set display_order = ranked.next_order
from ranked
where p.id = ranked.id
  and p.display_order is null;
