// CRM module types (companies, pipeline, deals, tasks, activity timeline)

export type CrmStageType = 'open' | 'won' | 'lost'
export type CrmDealStatus = 'open' | 'won' | 'lost'
export type CrmTaskStatus = 'todo' | 'in_progress' | 'done'
export type CrmTaskPriority = 'low' | 'medium' | 'high' | 'urgent'

export type CrmDealSource =
  | 'web'
  | 'admin'
  | 'import'
  | 'whatsapp'
  | 'referral'
  | 'social'
  | 'pos'
  | 'marketplace'
  | 'other'

export type CrmActivityType =
  | 'deal_created'
  | 'stage_changed'
  | 'deal_won'
  | 'deal_lost'
  | 'deal_reopened'
  | 'task_created'
  | 'task_completed'
  | 'note'
  | 'call'
  | 'email'
  | 'whatsapp'
  | 'meeting'
  | 'company_created'

export interface CrmCompany {
  id: string
  name: string
  domain: string | null
  industry: string | null
  employee_count: number | null
  annual_revenue_cents: number | null
  phone: string | null
  email: string | null
  city: string | null
  state: string | null
  country: string
  address: string | null
  website: string | null
  linkedin_url: string | null
  tax_id: string | null
  notes: string | null
  tags: string[]
  owner_id: string | null
  created_at: string
  updated_at: string
  // Aggregates (optional, filled by detail queries)
  contacts_count?: number
  deals_count?: number
  open_deals_value_cents?: number
}

export interface CrmStage {
  id: string
  pipeline_id: string
  name: string
  color: string
  position: number
  stage_type: CrmStageType
  win_probability: number
  created_at: string
  updated_at: string
}

export interface CrmPipeline {
  id: string
  name: string
  description: string | null
  is_default: boolean
  position: number
  created_at: string
  updated_at: string
  stages?: CrmStage[]
}

// Lightweight refs embedded in deal rows
export interface CrmDealCustomerRef {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  avatar_url: string | null
}

export interface CrmDealCompanyRef {
  id: string
  name: string
}

export interface CrmDeal {
  id: string
  title: string
  description: string | null
  pipeline_id: string
  stage_id: string
  customer_id: string | null
  company_id: string | null
  amount_cents: number
  currency: string
  probability: number | null
  status: CrmDealStatus
  expected_close_date: string | null
  closed_at: string | null
  lost_reason: string | null
  source: CrmDealSource
  owner_id: string | null
  position: number
  tags: string[]
  created_at: string
  updated_at: string
  // Joined refs
  customer?: CrmDealCustomerRef | null
  company?: CrmDealCompanyRef | null
  stage?: Pick<CrmStage, 'id' | 'name' | 'color' | 'stage_type'> | null
}

export interface CrmTask {
  id: string
  title: string
  description: string | null
  status: CrmTaskStatus
  priority: CrmTaskPriority
  due_at: string | null
  completed_at: string | null
  assignee_id: string | null
  deal_id: string | null
  customer_id: string | null
  company_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined refs
  deal?: { id: string; title: string } | null
  customer?: CrmDealCustomerRef | null
  company?: CrmDealCompanyRef | null
}

export interface CrmActivity {
  id: string
  activity_type: CrmActivityType
  deal_id: string | null
  customer_id: string | null
  company_id: string | null
  task_id: string | null
  actor_id: string | null
  body: string | null
  payload: Record<string, unknown> | null
  created_at: string
}

// Kanban board shape returned by the pipeline endpoint
export interface CrmBoardColumn {
  stage: CrmStage
  deals: CrmDeal[]
  total_value_cents: number
  count: number
}

export interface CrmBoard {
  pipeline: CrmPipeline
  columns: CrmBoardColumn[]
}

export interface CrmStats {
  open_deals: number
  open_value_cents: number
  won_this_month: number
  won_value_this_month_cents: number
  win_rate: number
  overdue_tasks: number
  pending_tasks: number
}
