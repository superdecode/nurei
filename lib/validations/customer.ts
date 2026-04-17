import { z } from 'zod'

export const customerTypeEnum = z.enum(['individual', 'business'])
export const customerSourceEnum = z.enum([
  'web', 'admin', 'import', 'whatsapp', 'referral',
  'social', 'pos', 'marketplace', 'other',
])
export const customerSegmentEnum = z.enum([
  'new', 'regular', 'vip', 'at_risk', 'lost', 'blacklist',
])
export const customerGenderEnum = z.enum(['male', 'female', 'other', 'prefer_not_to_say'])
export const customerRiskEnum = z.enum(['normal', 'low', 'medium', 'high'])
export const customerNoteKindEnum = z.enum([
  'note', 'call', 'email', 'whatsapp',
  'visit', 'complaint', 'compliment', 'system',
])

const emptyToUndef = (v: unknown) =>
  v === '' || v === null ? undefined : v

const optionalEmail = z.preprocess(emptyToUndef, z.string().email('Email inválido').optional())
// Permissive: accept any phone-like string 7-25 chars (digits, spaces, +, -, (), .)
const optionalPhone = z.preprocess(
  emptyToUndef,
  z.string()
    .min(7, 'Teléfono muy corto (mín 7 caracteres)')
    .max(25, 'Teléfono muy largo')
    .regex(/^[\d\s+\-().]+$/, 'Teléfono inválido — solo dígitos, espacios y +()-')
    .optional(),
)

export const customerAddressSchema = z.object({
  label: z.string().min(1).max(40).default('Casa'),
  recipient_name: z.string().min(1, 'Destinatario requerido').max(120),
  phone: optionalPhone,
  street: z.string().min(1, 'Calle requerida').max(160),
  exterior_number: z.string().max(20).optional().nullable(),
  interior_number: z.string().max(20).optional().nullable(),
  colonia: z.string().max(120).optional().nullable(),
  city: z.string().min(1, 'Ciudad requerida').max(120),
  state: z.string().min(1, 'Estado requerido').max(120),
  country: z.string().default('México'),
  zip_code: z.string().regex(/^\d{4,10}$/, 'CP inválido'),
  instructions: z.string().max(300).optional().nullable(),
  latitude: z.number().gte(-90).lte(90).optional().nullable(),
  longitude: z.number().gte(-180).lte(180).optional().nullable(),
  is_default_shipping: z.boolean().default(false),
  is_default_billing: z.boolean().default(false),
})

const createCustomerBase = z.object({
  first_name: z.string().min(1, 'Nombre requerido').max(80),
  last_name: z.string().max(80).optional().nullable(),
  email: optionalEmail,
  phone: optionalPhone,
  whatsapp: optionalPhone,

  customer_type: customerTypeEnum.default('individual'),
  company_name: z.string().max(160).optional().nullable(),
  tax_id: z.preprocess(
    emptyToUndef,
    z.string().max(20).optional(),
  ),
  tax_regime: z.string().max(80).optional().nullable(),
  billing_email: optionalEmail,

  birthday: z.preprocess(
    emptyToUndef,
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida').optional(),
  ),
  gender: customerGenderEnum.optional(),
  preferred_language: z.string().default('es'),

  source: customerSourceEnum.default('admin'),
  referral_code: z.string().max(40).optional().nullable(),
  utm_source: z.string().max(80).optional().nullable(),
  utm_medium: z.string().max(80).optional().nullable(),
  utm_campaign: z.string().max(80).optional().nullable(),

  segment: customerSegmentEnum.default('new'),
  tags: z.array(z.string().min(1).max(40)).default([]),

  accepts_marketing: z.boolean().default(false),
  accepts_email_marketing: z.boolean().default(false),
  accepts_sms_marketing: z.boolean().default(false),
  accepts_whatsapp_marketing: z.boolean().default(false),

  loyalty_points: z.number().int().min(0).default(0),
  store_credit_cents: z.number().int().min(0).default(0),

  is_active: z.boolean().default(true),
  is_verified: z.boolean().default(false),
  risk_level: customerRiskEnum.default('normal'),
  internal_notes: z.string().max(2000).optional().nullable(),

  addresses: z.array(customerAddressSchema).optional(),
})

export const createCustomerSchema = createCustomerBase
  .refine(
    (d) => Boolean(d.email || d.phone),
    { message: 'Email o teléfono es requerido', path: ['email'] },
  )
  .refine(
    (d) => d.customer_type !== 'business' || Boolean(d.company_name?.trim()),
    { message: 'Empresa es requerida para clientes tipo empresa', path: ['company_name'] },
  )

export const updateCustomerSchema = createCustomerBase.partial()

export const customerNoteSchema = z.object({
  note: z.string().min(1, 'El comentario no puede estar vacío').max(4000),
  kind: customerNoteKindEnum.default('note'),
  is_pinned: z.boolean().default(false),
})

/** Query strings are always strings; z.coerce.boolean() wrongly maps "false" → true. */
const boolQuery = z
  .union([z.literal('true'), z.literal('false')])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === 'true'))

export const customerListQuerySchema = z.object({
  search: z.string().optional(),
  segment: z.union([customerSegmentEnum, z.literal('all')]).default('all'),
  type: z.union([customerTypeEnum, z.literal('all')]).default('all'),
  tag: z.string().optional(),
  has_orders: boolQuery,
  is_active: boolQuery,
  accepts_marketing: boolQuery,
  min_spent_cents: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(0).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.enum(['created_at', 'last_order_at', 'total_spent_cents', 'orders_count', 'full_name']).default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
})

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>
export type CustomerAddressInput = z.infer<typeof customerAddressSchema>
export type CustomerNoteInput = z.infer<typeof customerNoteSchema>
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>
