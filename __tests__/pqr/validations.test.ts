import { describe, it, expect } from 'vitest'
import { createPqrSchema } from '@/lib/validations/pqr'

const validInput = {
  tipo: 'reclamo' as const,
  asunto: 'Pedido llegó incompleto',
  mensaje: 'Faltó una bolsa de ramen en mi pedido, ¿podrían revisar?',
  cliente_email: 'cliente@example.com',
}

describe('createPqrSchema', () => {
  it('accepts a well-formed submission', () => {
    const result = createPqrSchema.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('accepts the optional cliente_nombre and order_id when present', () => {
    const result = createPqrSchema.safeParse({
      ...validInput,
      cliente_nombre: 'Elian',
      order_id: '11111111-1111-4111-8111-111111111111',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid tipo', () => {
    const result = createPqrSchema.safeParse({ ...validInput, tipo: 'not-a-real-type' })
    expect(result.success).toBe(false)
  })

  it('rejects an asunto shorter than 3 characters', () => {
    const result = createPqrSchema.safeParse({ ...validInput, asunto: 'hi' })
    expect(result.success).toBe(false)
  })

  it('rejects a mensaje shorter than 10 characters', () => {
    const result = createPqrSchema.safeParse({ ...validInput, mensaje: 'too short' })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid email', () => {
    const result = createPqrSchema.safeParse({ ...validInput, cliente_email: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('rejects a non-uuid order_id', () => {
    const result = createPqrSchema.safeParse({ ...validInput, order_id: 'NUR-11001' })
    expect(result.success).toBe(false)
  })

  it('trims whitespace from asunto and mensaje', () => {
    const result = createPqrSchema.safeParse({
      ...validInput,
      asunto: '  Pedido incompleto  ',
      mensaje: '  Faltó una bolsa de ramen en mi pedido.  ',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.asunto).toBe('Pedido incompleto')
      expect(result.data.mensaje).toBe('Faltó una bolsa de ramen en mi pedido.')
    }
  })
})
