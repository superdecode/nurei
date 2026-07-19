import { z } from 'zod'

export const pqrTipoEnum = z.enum(['peticion', 'queja', 'reclamo', 'sugerencia'])
export const pqrEstadoEnum = z.enum(['abierto', 'en_proceso', 'resuelto', 'cerrado'])
export const pqrPrioridadEnum = z.enum(['baja', 'media', 'alta', 'urgente'])

export const createPqrSchema = z.object({
  tipo: pqrTipoEnum,
  asunto: z.string().trim().min(3, 'El asunto es muy corto').max(200, 'El asunto es muy largo'),
  mensaje: z.string().trim().min(10, 'Cuéntanos un poco más (mínimo 10 caracteres)').max(4000, 'El mensaje es muy largo'),
  cliente_email: z.string().trim().email('Correo inválido'),
  cliente_nombre: z.string().trim().max(200).optional(),
  order_id: z.string().uuid().optional(),
})

export type CreatePqrInput = z.infer<typeof createPqrSchema>
