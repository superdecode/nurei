import { describe, it, expect } from 'vitest'
import { mandarinExerciseAttemptSchema } from '@/lib/validations/mandarin'

describe('mandarinExerciseAttemptSchema', () => {
  it('accepts a multiple-choice style response', () => {
    const result = mandarinExerciseAttemptSchema.safeParse({ response: { selected: 'hola' } })
    expect(result.success).toBe(true)
  })

  it('accepts a sentence-order style response', () => {
    const result = mandarinExerciseAttemptSchema.safeParse({ response: { order: [0, 1, 2] } })
    expect(result.success).toBe(true)
  })

  it('rejects a missing response', () => {
    const result = mandarinExerciseAttemptSchema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('rejects a non-object response', () => {
    const result = mandarinExerciseAttemptSchema.safeParse({ response: 'hola' })
    expect(result.success).toBe(false)
  })
})
