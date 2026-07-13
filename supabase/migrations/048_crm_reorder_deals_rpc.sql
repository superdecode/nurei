-- Atomic kanban reorder for CRM deals.
-- Replaces the app-side Promise.all of individual UPDATEs (non-transactional,
-- could leave positions inconsistent on partial failure) with a single
-- transactional function. Moving a deal into a won/lost stage closes it; the
-- existing crm_sync_deal_close_state trigger then syncs closed_at/probability.

create or replace function public.crm_reorder_deals(
  p_deal_id     uuid,
  p_stage_id    uuid,
  p_ordered_ids uuid[]
)
returns void as $$
declare
  v_stage_type text;
  v_status     text;
  v_id         uuid;
  v_index      integer := 0;
  v_found      boolean := false;
begin
  select stage_type into v_stage_type from public.crm_stages where id = p_stage_id;
  if v_stage_type is null then
    raise exception 'stage % not found', p_stage_id;
  end if;

  v_status := case v_stage_type
    when 'won' then 'won'
    when 'lost' then 'lost'
    else 'open'
  end;

  foreach v_id in array coalesce(p_ordered_ids, array[]::uuid[]) loop
    if v_id = p_deal_id then
      update public.crm_deals
        set stage_id = p_stage_id, position = v_index, status = v_status
        where id = v_id;
      v_found := true;
    else
      update public.crm_deals set position = v_index where id = v_id;
    end if;
    v_index := v_index + 1;
  end loop;

  -- If the client omitted the dragged deal from the ordering, still move it
  if not v_found then
    update public.crm_deals
      set stage_id = p_stage_id, position = v_index, status = v_status
      where id = p_deal_id;
  end if;
end;
$$ language plpgsql security definer set search_path = public;
