import { z } from 'zod'

export const checkoutFormSchema = z.object({
  delivery_address: z.string().min(5, 'Ingresa una dirección válida'),
  delivery_instructions: z.string().max(200).optional(),
  customer_phone: z
    .string()
    .min(10, 'Ingresa un teléfono válido')
    .max(15)
    .regex(/^[0-9\s+()-]+$/, 'Formato de teléfono inválido'),
  customer_email: z.string().email('Email inválido').optional().or(z.literal('')),
  customer_name: z.string().optional(),
  coupon_code: z.string().optional(),
})

export type CheckoutFormData = z.infer<typeof checkoutFormSchema>

export const updateStatusSchema = z.object({
  status: z.enum([
    'pending',
    'confirmed',
    'shipped',
    'delivered',
    'cancelled',
    'failed',
  ]),
  notes: z.string().optional(),
})

export const createOrderSchema = z.object({
  customer_phone: z.string().min(10),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  delivery_address: z.string().min(5),
  delivery_instructions: z.string().max(200).optional(),
  coupon_code: z.string().optional(),
  items: z
    .array(
      z.object({
        product_id: z.string(),
        quantity: z.number().int().min(1).max(20),
      })
    )
    .min(1, 'Agrega al menos un producto'),
})
