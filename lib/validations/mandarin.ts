import { z } from 'zod'

export const mandarinSubscribeSchema = z.object({
  email: z.string().trim().email('Correo inválido').max(200),
})

export type MandarinSubscribeInput = z.infer<typeof mandarinSubscribeSchema>

export const mandarinExerciseAttemptSchema = z.object({
  response: z.record(z.string(), z.unknown()),
})

export type MandarinExerciseAttemptInput = z.infer<typeof mandarinExerciseAttemptSchema>
