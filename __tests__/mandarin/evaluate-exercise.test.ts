import { describe, it, expect } from 'vitest'
import { evaluateExercise } from '@/lib/mandarin/evaluate-exercise'

describe('evaluateExercise: vocab_multiple_choice', () => {
  const data = { vocab_id: 'v1', options: ['hola', 'adiós', 'gracias'], correct_option: 'hola' }

  it('returns true for the correct option', () => {
    expect(evaluateExercise('vocab_multiple_choice', data, { selected: 'hola' })).toBe(true)
  })

  it('returns false for an incorrect option', () => {
    expect(evaluateExercise('vocab_multiple_choice', data, { selected: 'adiós' })).toBe(false)
  })

  it('returns false for a malformed response', () => {
    expect(evaluateExercise('vocab_multiple_choice', data, { selected: 42 })).toBe(false)
  })
})

describe('evaluateExercise: sentence_order', () => {
  const data = { tokens: ['我', '是', '学生'], correct_order: [0, 1, 2] }

  it('returns true when the order matches', () => {
    expect(evaluateExercise('sentence_order', data, { order: [0, 1, 2] })).toBe(true)
  })

  it('returns false when the order does not match', () => {
    expect(evaluateExercise('sentence_order', data, { order: [1, 0, 2] })).toBe(false)
  })

  it('returns false when the order has the wrong length', () => {
    expect(evaluateExercise('sentence_order', data, { order: [0, 1] })).toBe(false)
  })

  it('returns false for a malformed response', () => {
    expect(evaluateExercise('sentence_order', data, { order: 'not-an-array' })).toBe(false)
  })
})
