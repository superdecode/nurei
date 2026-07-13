import { SupabaseClient } from '@supabase/supabase-js'
import type {
  CrmActivity,
  CrmActivityType,
  CrmBoard,
  CrmBoardColumn,
  CrmCompany,
  CrmDeal,
  CrmPipeline,
  CrmStage,
  CrmStats,
  CrmTask,
} from '@/types'
import type {
  CreateActivityInput,
  CreateCompanyInput,
  CreateDealInput,
  CreateTaskInput,
  MoveDealInput,
  UpdateCompanyInput,
  UpdateDealInput,
  UpdateTaskInput,
} from '@/lib/validations/crm'

// Column projection for deals with joined refs
const DEAL_SELECT = `
  *,
  customer:customers ( id, full_name, email, phone, avatar_url ),
  company:crm_companies ( id, name ),
  stage:crm_stages ( id, name, color, stage_type )
`

const TASK_SELECT = `
  *,
  deal:crm_deals ( id, title ),
  customer:customers ( id, full_name, email, phone, avatar_url ),
  company:crm_companies ( id, name )
`

// ─── Pipelines & stages ──────────────────────
export async function getDefaultPipeline(
  supabase: SupabaseClient,
): Promise<CrmPipeline | null> {
  const { data: pipeline } = await supabase
    .from('crm_pipelines')
    .select('*')
    .order('is_default', { ascending: false })
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!pipeline) return null

  const { data: stages } = await supabase
    .from('crm_stages')
    .select('*')
    .eq('pipeline_id', pipeline.id)
    .order('position', { ascending: true })

  return { ...pipeline, stages: (stages ?? []) as CrmStage[] } as CrmPipeline
}

export async function listPipelines(supabase: SupabaseClient): Promise<CrmPipeline[]> {
  const { data: pipelines } = await supabase
    .from('crm_pipelines')
    .select('*')
    .order('position', { ascending: true })

  if (!pipelines?.length) return []

  const { data: stages } = await supabase
    .from('crm_stages')
    .select('*')
    .in('pipeline_id', pipelines.map((p) => p.id))
    .order('position', { ascending: true })

  return pipelines.map((p) => ({
    ...p,
    stages: (stages ?? []).filter((s) => s.pipeline_id === p.id),
  })) as CrmPipeline[]
}

// ─── Kanban board ────────────────────────────
export async function getBoard(
  supabase: SupabaseClient,
  pipelineId?: string,
): Promise<CrmBoard | null> {
  const pipeline = pipelineId
    ? await (async () => {
        const { data } = await supabase.from('crm_pipelines').select('*').eq('id', pipelineId).maybeSingle()
        if (!data) return null
        const { data: stages } = await supabase
          .from('crm_stages').select('*').eq('pipeline_id', data.id).order('position', { ascending: true })
        return { ...data, stages: (stages ?? []) as CrmStage[] } as CrmPipeline
      })()
    : await getDefaultPipeline(supabase)

  if (!pipeline?.stages) return null

  const { data: deals } = await supabase
    .from('crm_deals')
    .select(DEAL_SELECT)
    .eq('pipeline_id', pipeline.id)
    .order('position', { ascending: true })
    .order('created_at', { ascending: false })

  const dealsByStage = new Map<string, CrmDeal[]>()
  for (const deal of (deals ?? []) as CrmDeal[]) {
    const list = dealsByStage.get(deal.stage_id) ?? []
    list.push(deal)
    dealsByStage.set(deal.stage_id, list)
  }

  const columns: CrmBoardColumn[] = pipeline.stages.map((stage) => {
    const stageDeals = dealsByStage.get(stage.id) ?? []
    return {
      stage,
      deals: stageDeals,
      count: stageDeals.length,
      total_value_cents: stageDeals.reduce((sum, d) => sum + (d.amount_cents ?? 0), 0),
    }
  })

  return { pipeline, columns }
}

// ─── Deals ───────────────────────────────────
interface DealListFilters {
  status?: 'open' | 'won' | 'lost' | 'all'
  customerId?: string
  companyId?: string
  search?: string
  limit?: number
}

export async function listDeals(
  supabase: SupabaseClient,
  filters: DealListFilters = {},
): Promise<CrmDeal[]> {
  let query = supabase.from('crm_deals').select(DEAL_SELECT).order('created_at', { ascending: false })

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.companyId) query = query.eq('company_id', filters.companyId)
  if (filters.search) query = query.ilike('title', `%${filters.search}%`)
  query = query.limit(Math.min(filters.limit ?? 200, 500))

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CrmDeal[]
}

export async function getDeal(supabase: SupabaseClient, id: string): Promise<CrmDeal | null> {
  const { data } = await supabase.from('crm_deals').select(DEAL_SELECT).eq('id', id).maybeSingle()
  return (data as CrmDeal) ?? null
}

export async function createDeal(
  supabase: SupabaseClient,
  input: CreateDealInput,
  actorId: string,
): Promise<CrmDeal> {
  // Resolve pipeline + stage defaults
  let pipelineId = input.pipeline_id
  let stageId = input.stage_id

  if (!pipelineId || !stageId) {
    const pipeline = await getDefaultPipeline(supabase)
    if (!pipeline?.stages?.length) throw new Error('No hay un pipeline configurado')
    pipelineId = pipelineId ?? pipeline.id
    stageId = stageId ?? pipeline.stages.find((s) => s.stage_type === 'open')?.id ?? pipeline.stages[0].id
  }

  // Place at top of the target stage
  const { data: topDeal } = await supabase
    .from('crm_deals')
    .select('position')
    .eq('stage_id', stageId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  const position = (topDeal?.position ?? 0) - 1

  const { data, error } = await supabase
    .from('crm_deals')
    .insert({
      title: input.title,
      description: input.description ?? null,
      pipeline_id: pipelineId,
      stage_id: stageId,
      customer_id: input.customer_id ?? null,
      company_id: input.company_id ?? null,
      amount_cents: input.amount_cents ?? 0,
      currency: input.currency ?? 'MXN',
      probability: input.probability ?? null,
      expected_close_date: input.expected_close_date ?? null,
      source: input.source ?? 'admin',
      tags: input.tags ?? [],
      owner_id: actorId,
      position,
    })
    .select(DEAL_SELECT)
    .single()

  if (error) throw error
  const deal = data as CrmDeal

  await logActivity(supabase, {
    activity_type: 'deal_created',
    deal_id: deal.id,
    customer_id: deal.customer_id,
    company_id: deal.company_id,
    actor_id: actorId,
    body: `Oportunidad creada: ${deal.title}`,
  })

  return deal
}

export async function updateDeal(
  supabase: SupabaseClient,
  id: string,
  input: UpdateDealInput,
  actorId: string,
): Promise<CrmDeal> {
  const before = await getDeal(supabase, id)
  if (!before) throw new Error('Oportunidad no encontrada')

  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) patch[key] = value
  }

  const { data, error } = await supabase
    .from('crm_deals')
    .update(patch)
    .eq('id', id)
    .select(DEAL_SELECT)
    .single()
  if (error) throw error
  const after = data as CrmDeal

  // Timeline entries for meaningful transitions
  if (input.stage_id && input.stage_id !== before.stage_id && after.status === 'open') {
    await logActivity(supabase, {
      activity_type: 'stage_changed',
      deal_id: id,
      customer_id: after.customer_id,
      company_id: after.company_id,
      actor_id: actorId,
      body: `Etapa cambiada a ${after.stage?.name ?? ''}`.trim(),
      payload: { from_stage: before.stage_id, to_stage: input.stage_id },
    })
  }
  if (input.status && input.status !== before.status) {
    const map: Record<string, CrmActivityType> = {
      won: 'deal_won',
      lost: 'deal_lost',
      open: 'deal_reopened',
    }
    await logActivity(supabase, {
      activity_type: map[input.status],
      deal_id: id,
      customer_id: after.customer_id,
      company_id: after.company_id,
      actor_id: actorId,
      body:
        input.status === 'won'
          ? 'Oportunidad ganada'
          : input.status === 'lost'
            ? `Oportunidad perdida${input.lost_reason ? `: ${input.lost_reason}` : ''}`
            : 'Oportunidad reabierta',
    })
  }

  return after
}

export async function deleteDeal(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('crm_deals').delete().eq('id', id)
  if (error) throw error
}

// Kanban drag: move a deal to a stage and re-order the stage
export async function moveDeal(
  supabase: SupabaseClient,
  dealId: string,
  input: MoveDealInput,
  actorId: string,
): Promise<void> {
  const before = await getDeal(supabase, dealId)
  if (!before) throw new Error('Oportunidad no encontrada')

  // Stage type drives status (moving into a won/lost column closes the deal)
  const { data: stage } = await supabase
    .from('crm_stages')
    .select('id, name, stage_type')
    .eq('id', input.stage_id)
    .maybeSingle()
  if (!stage) throw new Error('Etapa no encontrada')

  const status = stage.stage_type === 'won' ? 'won' : stage.stage_type === 'lost' ? 'lost' : 'open'

  // Persist new order for every deal in the target stage
  const updates = input.ordered_ids.map((id, index) =>
    supabase
      .from('crm_deals')
      .update(
        id === dealId
          ? { stage_id: input.stage_id, position: index, status }
          : { position: index },
      )
      .eq('id', id),
  )
  const results = await Promise.all(updates)
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error

  if (before.stage_id !== input.stage_id) {
    const type: CrmActivityType =
      status === 'won' ? 'deal_won' : status === 'lost' ? 'deal_lost' : 'stage_changed'
    await logActivity(supabase, {
      activity_type: type,
      deal_id: dealId,
      customer_id: before.customer_id,
      company_id: before.company_id,
      actor_id: actorId,
      body:
        status === 'won'
          ? 'Oportunidad ganada'
          : status === 'lost'
            ? 'Oportunidad perdida'
            : `Etapa cambiada a ${stage.name}`,
      payload: { from_stage: before.stage_id, to_stage: input.stage_id },
    })
  }
}

// ─── Companies ───────────────────────────────
interface CompanyListFilters {
  search?: string
  limit?: number
}

export async function listCompanies(
  supabase: SupabaseClient,
  filters: CompanyListFilters = {},
): Promise<CrmCompany[]> {
  let query = supabase.from('crm_companies').select('*').order('created_at', { ascending: false })
  if (filters.search) query = query.ilike('name', `%${filters.search}%`)
  query = query.limit(Math.min(filters.limit ?? 200, 500))

  const { data, error } = await query
  if (error) throw error
  const companies = (data ?? []) as CrmCompany[]

  // Cheap aggregates: contact + open-deal counts per company
  if (companies.length) {
    const ids = companies.map((c) => c.id)
    const [{ data: contacts }, { data: deals }] = await Promise.all([
      supabase.from('customers').select('crm_company_id').in('crm_company_id', ids),
      supabase.from('crm_deals').select('company_id, amount_cents, status').in('company_id', ids),
    ])
    const contactCount = new Map<string, number>()
    for (const c of contacts ?? []) {
      if (c.crm_company_id) contactCount.set(c.crm_company_id, (contactCount.get(c.crm_company_id) ?? 0) + 1)
    }
    const dealCount = new Map<string, number>()
    const openValue = new Map<string, number>()
    for (const d of deals ?? []) {
      if (!d.company_id) continue
      dealCount.set(d.company_id, (dealCount.get(d.company_id) ?? 0) + 1)
      if (d.status === 'open') openValue.set(d.company_id, (openValue.get(d.company_id) ?? 0) + (d.amount_cents ?? 0))
    }
    for (const company of companies) {
      company.contacts_count = contactCount.get(company.id) ?? 0
      company.deals_count = dealCount.get(company.id) ?? 0
      company.open_deals_value_cents = openValue.get(company.id) ?? 0
    }
  }

  return companies
}

export async function getCompany(supabase: SupabaseClient, id: string): Promise<CrmCompany | null> {
  const { data } = await supabase.from('crm_companies').select('*').eq('id', id).maybeSingle()
  return (data as CrmCompany) ?? null
}

export async function createCompany(
  supabase: SupabaseClient,
  input: CreateCompanyInput,
  actorId: string,
): Promise<CrmCompany> {
  const { data, error } = await supabase
    .from('crm_companies')
    .insert({ ...normalizeCompany(input), country: input.country ?? 'México', owner_id: actorId })
    .select('*')
    .single()
  if (error) throw error
  const company = data as CrmCompany
  await logActivity(supabase, {
    activity_type: 'company_created',
    company_id: company.id,
    actor_id: actorId,
    body: `Empresa creada: ${company.name}`,
  })
  return company
}

export async function updateCompany(
  supabase: SupabaseClient,
  id: string,
  input: UpdateCompanyInput,
): Promise<CrmCompany> {
  const { data, error } = await supabase
    .from('crm_companies')
    .update(normalizeCompany(input))
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as CrmCompany
}

export async function deleteCompany(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('crm_companies').delete().eq('id', id)
  if (error) throw error
}

function normalizeCompany(input: Partial<CreateCompanyInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    out[key] = value === '' ? null : value
  }
  return out
}

// ─── Tasks ───────────────────────────────────
interface TaskListFilters {
  status?: 'todo' | 'in_progress' | 'done' | 'open' | 'all'
  dealId?: string
  customerId?: string
  companyId?: string
  assigneeId?: string
  limit?: number
}

export async function listTasks(
  supabase: SupabaseClient,
  filters: TaskListFilters = {},
): Promise<CrmTask[]> {
  let query = supabase.from('crm_tasks').select(TASK_SELECT)

  if (filters.status === 'open') query = query.neq('status', 'done')
  else if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.dealId) query = query.eq('deal_id', filters.dealId)
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.companyId) query = query.eq('company_id', filters.companyId)
  if (filters.assigneeId) query = query.eq('assignee_id', filters.assigneeId)

  // Pending first (nulls last on due date), then newest
  query = query
    .order('status', { ascending: true })
    .order('due_at', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(Math.min(filters.limit ?? 200, 500))

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CrmTask[]
}

export async function createTask(
  supabase: SupabaseClient,
  input: CreateTaskInput,
  actorId: string,
): Promise<CrmTask> {
  const { data, error } = await supabase
    .from('crm_tasks')
    .insert({
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      due_at: input.due_at ?? null,
      assignee_id: input.assignee_id ?? actorId,
      deal_id: input.deal_id ?? null,
      customer_id: input.customer_id ?? null,
      company_id: input.company_id ?? null,
      created_by: actorId,
    })
    .select(TASK_SELECT)
    .single()
  if (error) throw error
  const task = data as CrmTask
  await logActivity(supabase, {
    activity_type: 'task_created',
    task_id: task.id,
    deal_id: task.deal_id,
    customer_id: task.customer_id,
    company_id: task.company_id,
    actor_id: actorId,
    body: `Tarea creada: ${task.title}`,
  })
  return task
}

export async function updateTask(
  supabase: SupabaseClient,
  id: string,
  input: UpdateTaskInput,
  actorId: string,
): Promise<CrmTask> {
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) patch[key] = value
  }
  const { data, error } = await supabase
    .from('crm_tasks')
    .update(patch)
    .eq('id', id)
    .select(TASK_SELECT)
    .single()
  if (error) throw error
  const task = data as CrmTask
  if (input.status === 'done') {
    await logActivity(supabase, {
      activity_type: 'task_completed',
      task_id: task.id,
      deal_id: task.deal_id,
      customer_id: task.customer_id,
      company_id: task.company_id,
      actor_id: actorId,
      body: `Tarea completada: ${task.title}`,
    })
  }
  return task
}

export async function deleteTask(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('crm_tasks').delete().eq('id', id)
  if (error) throw error
}

// ─── Activities (timeline) ───────────────────
interface LogActivityInput {
  activity_type: CrmActivityType
  deal_id?: string | null
  customer_id?: string | null
  company_id?: string | null
  task_id?: string | null
  actor_id?: string | null
  body?: string | null
  payload?: Record<string, unknown> | null
}

export async function logActivity(
  supabase: SupabaseClient,
  input: LogActivityInput,
): Promise<void> {
  // Timeline writes must never break the primary operation
  const { error } = await supabase.from('crm_activities').insert({
    activity_type: input.activity_type,
    deal_id: input.deal_id ?? null,
    customer_id: input.customer_id ?? null,
    company_id: input.company_id ?? null,
    task_id: input.task_id ?? null,
    actor_id: input.actor_id ?? null,
    body: input.body ?? null,
    payload: input.payload ?? null,
  })
  if (error) console.error('[crm] logActivity failed:', error.message)
}

export async function createManualActivity(
  supabase: SupabaseClient,
  input: CreateActivityInput,
  actorId: string,
): Promise<void> {
  await logActivity(supabase, { ...input, actor_id: actorId })
}

interface TimelineFilters {
  dealId?: string
  customerId?: string
  companyId?: string
  limit?: number
}

export async function listActivities(
  supabase: SupabaseClient,
  filters: TimelineFilters,
): Promise<CrmActivity[]> {
  let query = supabase.from('crm_activities').select('*').order('created_at', { ascending: false })
  if (filters.dealId) query = query.eq('deal_id', filters.dealId)
  if (filters.customerId) query = query.eq('customer_id', filters.customerId)
  if (filters.companyId) query = query.eq('company_id', filters.companyId)
  query = query.limit(Math.min(filters.limit ?? 100, 200))

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as CrmActivity[]
}

// ─── Stats ───────────────────────────────────
export async function getCrmStats(supabase: SupabaseClient): Promise<CrmStats> {
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const monthStartIso = monthStart.toISOString()
  const nowIso = new Date().toISOString()

  const [openDeals, wonMonth, lostMonth, overdue, pending] = await Promise.all([
    supabase.from('crm_deals').select('amount_cents', { count: 'exact' }).eq('status', 'open'),
    supabase.from('crm_deals').select('amount_cents', { count: 'exact' }).eq('status', 'won').gte('closed_at', monthStartIso),
    supabase.from('crm_deals').select('id', { count: 'exact', head: true }).eq('status', 'lost').gte('closed_at', monthStartIso),
    supabase.from('crm_tasks').select('id', { count: 'exact', head: true }).neq('status', 'done').lt('due_at', nowIso),
    supabase.from('crm_tasks').select('id', { count: 'exact', head: true }).neq('status', 'done'),
  ])

  const openValue = (openDeals.data ?? []).reduce((s, d) => s + (d.amount_cents ?? 0), 0)
  const wonValue = (wonMonth.data ?? []).reduce((s, d) => s + (d.amount_cents ?? 0), 0)
  const wonCount = wonMonth.count ?? 0
  const lostCount = lostMonth.count ?? 0
  const closedTotal = wonCount + lostCount

  return {
    open_deals: openDeals.count ?? 0,
    open_value_cents: openValue,
    won_this_month: wonCount,
    won_value_this_month_cents: wonValue,
    win_rate: closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0,
    overdue_tasks: overdue.count ?? 0,
    pending_tasks: pending.count ?? 0,
  }
}
