import { describe, it, expect } from 'vitest'
import {
  createDealSchema,
  updateDealSchema,
  moveDealSchema,
  createCompanySchema,
  createTaskSchema,
  createActivitySchema,
} from '../../lib/validations/crm'

const UUID = '11111111-1111-4111-8111-111111111111'
const UUID2 = '22222222-2222-4222-8222-222222222222'

describe('createDealSchema', () => {
  it('requires a non-empty title', () => {
    expect(createDealSchema.safeParse({ title: '' }).success).toBe(false)
    expect(createDealSchema.safeParse({}).success).toBe(false)
  })

  it('applies defaults for amount, currency and source', () => {
    const parsed = createDealSchema.parse({ title: 'Pedido mayorista' })
    expect(parsed.amount_cents).toBe(0)
    expect(parsed.currency).toBe('MXN')
    expect(parsed.source).toBe('admin')
  })

  it('coerces numeric strings for amount_cents', () => {
    const parsed = createDealSchema.parse({ title: 'X', amount_cents: '15000' })
    expect(parsed.amount_cents).toBe(15000)
  })

  it('rejects negative amounts', () => {
    expect(createDealSchema.safeParse({ title: 'X', amount_cents: -1 }).success).toBe(false)
  })

  it('bounds probability to 0..100', () => {
    expect(createDealSchema.safeParse({ title: 'X', probability: 101 }).success).toBe(false)
    expect(createDealSchema.safeParse({ title: 'X', probability: 50 }).success).toBe(true)
  })

  it('rejects an invalid source', () => {
    expect(createDealSchema.safeParse({ title: 'X', source: 'telepathy' }).success).toBe(false)
  })

  it('validates expected_close_date as a date string', () => {
    expect(createDealSchema.safeParse({ title: 'X', expected_close_date: '2026-08-01' }).success).toBe(true)
    expect(createDealSchema.safeParse({ title: 'X', expected_close_date: 'not-a-date' }).success).toBe(false)
  })
})

describe('updateDealSchema', () => {
  it('accepts a status transition', () => {
    expect(updateDealSchema.safeParse({ status: 'won' }).success).toBe(true)
    expect(updateDealSchema.safeParse({ status: 'archived' }).success).toBe(false)
  })

  it('allows nulling optional relations', () => {
    const parsed = updateDealSchema.parse({ customer_id: null, company_id: null })
    expect(parsed.customer_id).toBeNull()
    expect(parsed.company_id).toBeNull()
  })
})

describe('moveDealSchema', () => {
  it('requires a valid stage uuid and an id array', () => {
    const ok = moveDealSchema.safeParse({ stage_id: UUID, ordered_ids: [UUID, UUID2] })
    expect(ok.success).toBe(true)
  })

  it('accepts an empty ordering', () => {
    expect(moveDealSchema.safeParse({ stage_id: UUID, ordered_ids: [] }).success).toBe(true)
  })

  it('rejects a non-uuid stage', () => {
    expect(moveDealSchema.safeParse({ stage_id: 'abc', ordered_ids: [] }).success).toBe(false)
  })

  it('rejects non-uuid entries in the ordering', () => {
    expect(moveDealSchema.safeParse({ stage_id: UUID, ordered_ids: ['nope'] }).success).toBe(false)
  })
})

describe('createCompanySchema', () => {
  it('requires a name', () => {
    expect(createCompanySchema.safeParse({ name: '' }).success).toBe(false)
    expect(createCompanySchema.safeParse({ name: 'Sakura' }).success).toBe(true)
  })

  it('accepts an empty-string email (cleared field)', () => {
    expect(createCompanySchema.safeParse({ name: 'X', email: '' }).success).toBe(true)
  })

  it('rejects a malformed email', () => {
    expect(createCompanySchema.safeParse({ name: 'X', email: 'not-an-email' }).success).toBe(false)
  })
})

describe('createTaskSchema', () => {
  it('defaults status to todo and priority to medium', () => {
    const parsed = createTaskSchema.parse({ title: 'Llamar cliente' })
    expect(parsed.status).toBe('todo')
    expect(parsed.priority).toBe('medium')
  })

  it('rejects an invalid priority', () => {
    expect(createTaskSchema.safeParse({ title: 'X', priority: 'whenever' }).success).toBe(false)
  })

  it('accepts an ISO datetime for due_at', () => {
    expect(createTaskSchema.safeParse({ title: 'X', due_at: '2026-08-01T10:00:00.000Z' }).success).toBe(true)
    expect(createTaskSchema.safeParse({ title: 'X', due_at: '2026-08-01' }).success).toBe(false)
  })
})

describe('createActivitySchema', () => {
  it('requires a body and a valid type', () => {
    expect(createActivitySchema.safeParse({ activity_type: 'note', body: 'Hola', deal_id: UUID }).success).toBe(true)
    expect(createActivitySchema.safeParse({ activity_type: 'note', body: '' }).success).toBe(false)
    expect(createActivitySchema.safeParse({ activity_type: 'deal_won', body: 'x' }).success).toBe(false)
  })
})
