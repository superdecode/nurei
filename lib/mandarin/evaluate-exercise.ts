import type {
  MandarinExerciseType,
  MandarinVocabMultipleChoiceData,
  MandarinSentenceOrderData,
} from '@/types/mandarin'

function evaluateVocabMultipleChoice(
  data: MandarinVocabMultipleChoiceData,
  response: unknown
): boolean {
  if (typeof response !== 'object' || response === null || !('selected' in response)) return false
  const selected = (response as { selected: unknown }).selected
  return typeof selected === 'string' && selected === data.correct_option
}

function evaluateSentenceOrder(data: MandarinSentenceOrderData, response: unknown): boolean {
  if (typeof response !== 'object' || response === null || !('order' in response)) return false
  const order = (response as { order: unknown }).order
  if (!Array.isArray(order) || order.length !== data.correct_order.length) return false
  return order.every((value, index) => value === data.correct_order[index])
}

export function evaluateExercise(
  type: MandarinExerciseType,
  data: unknown,
  response: unknown
): boolean {
  if (type === 'vocab_multiple_choice') {
    return evaluateVocabMultipleChoice(data as MandarinVocabMultipleChoiceData, response)
  }
  return evaluateSentenceOrder(data as MandarinSentenceOrderData, response)
}
