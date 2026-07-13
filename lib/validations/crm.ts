import { z } from 'zod'

const uuid = z.string().uuid()
const nullableUuid = z.union([uuid, z.null()]).optional()

const DEAL_SOURCES = ['web', 'admin', 'import', 'whatsapp', 'referral', 'social', 'pos', 'marketplace', 'other'] as const

// ─── Companies ───────────────────────────────
export const createCompanySchema = z.object({
  name: z.string().trim().min(1, 'El nombre es requerido').max(200),
  domain: z.string().trim().max(200).optional().nullable(),
  industry: z.string().trim().max(120).optional().nullable(),
  employee_count: z.coerce.number().int().min(0).max(10_000_000).optional().nullable(),
  annual_revenue_cents: z.coerce.number().int().min(0).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(200).optional().nullable().or(z.literal('')),
  city: z.string().trim().max(120).optional().nullable(),
  state: z.string().trim().max(120).optional().nullable(),
  country: z.string().trim().max(120).optional(),
  address: z.string().trim().max(400).optional().nullable(),
  website: z.string().trim().max(300).optional().nullable(),
  linkedin_url: z.string().trim().max(300).optional().nullable(),
  tax_id: z.string().trim().max(40).optional().nullable(),
  notes: z.string().trim().max(5000).optional().nullable(),
  tags: z.array(z.string().trim().max(40)).max(30).optional(),
})

export const updateCompanySchema = createCompanySchema.partial()

// ─── Deals ───────────────────────────────────
export const createDealSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  pipeline_id: uuid.optional(), // defaults to the default pipeline server-side
  stage_id: uuid.optional(), // defaults to the first stage of the pipeline
  customer_id: nullableUuid,
  company_id: nullableUuid,
  amount_cents: z.coerce.number().int().min(0).default(0),
  currency: z.string().trim().length(3).default('MXN'),
  probability: z.coerce.number().int().min(0).max(100).optional().nullable(),
  expected_close_date: z.string().date().optional().nullable(),
  source: z.enum(DEAL_SOURCES).default('admin'),
  tags: z.array(z.string().trim().max(40)).max(30).optional(),
})

export const updateDealSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(5000).optional().nullable(),
  stage_id: uuid.optional(),
  customer_id: nullableUuid,
  company_id: nullableUuid,
  amount_cents: z.coerce.number().int().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional().nullable(),
  expected_close_date: z.string().date().optional().nullable(),
  status: z.enum(['open', 'won', 'lost']).optional(),
  lost_reason: z.string().trim().max(500).optional().nullable(),
  source: z.enum(DEAL_SOURCES).optional(),
  tags: z.array(z.string().trim().max(40)).max(30).optional(),
})

// Kanban move: new stage + ordered list of deal ids in that stage
export const moveDealSchema = z.object({
  stage_id: uuid,
  ordered_ids: z.array(uuid).max(1000),
})

// ─── Tasks ───────────────────────────────────
export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'El título es requerido').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done']).default('todo'),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  due_at: z.string().datetime({ offset: true }).optional().nullable(),
  assignee_id: nullableUuid,
  deal_id: nullableUuid,
  customer_id: nullableUuid,
  company_id: nullableUuid,
})

export const updateTaskSchema = createTaskSchema.partial()

// ─── Activities (manual timeline entries) ────
export const createActivitySchema = z.object({
  activity_type: z.enum(['note', 'call', 'email', 'whatsapp', 'meeting']),
  deal_id: nullableUuid,
  customer_id: nullableUuid,
  company_id: nullableUuid,
  body: z.string().trim().min(1).max(5000),
})

export type CreateCompanyInput = z.infer<typeof createCompanySchema>
export type UpdateCompanyInput = z.infer<typeof updateCompanySchema>
export type CreateDealInput = z.infer<typeof createDealSchema>
export type UpdateDealInput = z.infer<typeof updateDealSchema>
export type MoveDealInput = z.infer<typeof moveDealSchema>
export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type CreateActivityInput = z.infer<typeof createActivitySchema>
