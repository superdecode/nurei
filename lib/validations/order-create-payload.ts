import { z } from 'zod'

const FIELD_LABEL: Record<string, string> = {
  items: 'Productos',
  product_id: 'Producto',
  quantity: 'Cantidad',
  coupon_code: 'Cupón',
  customer: 'Datos de contacto',
  full_name: 'Nombre completo',
  email: 'Correo electrónico',
  phone: 'Teléfono',
  shipping: 'Envío',
  address: 'Dirección',
  city: 'Ciudad',
  state: 'Estado',
  zip_code: 'Código postal',
  country: 'País',
  method_id: 'Método de envío',
  method_label: 'Tipo de envío',
  fee: 'Costo de envío',
  eta_label: 'Tiempo de entrega',
  estimated_date: 'Fecha estimada de entrega',
  payment_method: 'Forma de pago',
}

function labelForIssuePath(path: PropertyKey[]): string {
  if (path.length === 0) return 'Pedido'
  const last = path[path.length - 1]
  if (typeof last === 'number') {
    return `Productos (línea ${last + 1})`
  }
  return FIELD_LABEL[String(last)] ?? String(last)
}

/** Lee los issues de Zod y arma un mensaje corto para toast (campo + mensaje). */
export function formatCreateOrderPayloadErrors(error: z.ZodError): string {
  const lines = error.issues.map((issue) => {
    const label = labelForIssuePath(issue.path)
    return `${label}: ${issue.message}`
  })
  const seen = new Set<string>()
  const unique: string[] = []
  for (const line of lines) {
    if (seen.has(line)) continue
    seen.add(line)
    unique.push(line)
    if (unique.length >= 5) break
  }
  return unique.join(' · ') || 'Revisa los datos del formulario e intenta de nuevo.'
}

export const createOrderPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        product_id: z.string().min(1, 'Indica el producto'),
        quantity: z
          .number({ error: () => 'Debe ser un número' })
          .int('Usa cantidades enteras')
          .min(1, 'La cantidad mínima es 1')
          .max(20, 'Máximo 20 unidades por producto'),
      })
    )
    .min(1, 'Agrega al menos un producto'),
  coupon_code: z.string().optional(),
  customer: z.object({
    full_name: z.string().min(3, 'Mínimo 3 caracteres'),
    email: z.string().email('Correo no válido'),
    phone: z.string().min(8, 'Teléfono incompleto (mínimo 8 caracteres)'),
  }),
  shipping: z.object({
    address: z.string().min(6, 'La dirección es demasiado corta'),
    city: z.string().min(2, 'Indica la ciudad'),
    state: z.string().min(2, 'Indica el estado'),
    zip_code: z.string().min(4, 'Código postal incompleto'),
    country: z.string().min(2, 'Indica el país'),
    method_id: z.string().min(1, 'Selecciona un método de envío válido'),
    method_label: z.string().min(2, 'Tipo de envío no válido'),
    fee: z
      .number({ error: () => 'Costo de envío no válido' })
      .min(0, 'El costo de envío no puede ser negativo'),
    eta_label: z.string().min(2, 'Tiempo de entrega no válido'),
    estimated_date: z.string().min(8, 'Fecha de entrega no válida'),
  }),
  payment_method: z.string().min(1, 'Selecciona una forma de pago válida'),
})

export type CreateOrderPayload = z.infer<typeof createOrderPayloadSchema>
