export type MandarinProgressStatus = 'not_started' | 'in_progress' | 'completed'
export type MandarinExerciseType = 'vocab_multiple_choice' | 'sentence_order'

export interface MandarinCourse {
  id: string
  slug: string
  title: string
  description: string | null
  is_published: boolean
}

export interface MandarinLevel {
  id: string
  course_id: string
  slug: string
  title: string
  order_index: number
  is_published: boolean
}

export interface MandarinUnit {
  id: string
  level_id: string
  slug: string
  title: string
  order_index: number
  is_published: boolean
}

export interface MandarinLessonSummary {
  id: string
  unit_id: string
  slug: string
  title: string
  objective: string | null
  order_index: number
  is_published: boolean
  is_demo_content: boolean
}

export interface MandarinVocabItem {
  id: string
  hanzi: string
  pinyin: string
  es: string
  notes: string | null
  audio_url: string | null
  example_hanzi: string | null
  example_pinyin: string | null
  example_es: string | null
}

export interface MandarinGrammarPoint {
  id: string
  title: string
  explanation: string
  order_index: number
}

export interface MandarinExample {
  id: string
  hanzi: string
  pinyin: string
  es: string
  order_index: number
  audio_url: string | null
}

export interface MandarinVocabMultipleChoiceData {
  vocab_id: string
  options: string[]
  correct_option: string
}

export interface MandarinSentenceOrderData {
  tokens: string[]
  correct_order: number[]
}

export type MandarinExerciseData = MandarinVocabMultipleChoiceData | MandarinSentenceOrderData

/** Exercise shape returned to the client — never includes the correct answer. */
export interface MandarinExercisePublic {
  id: string
  type: MandarinExerciseType
  prompt: string
  order_index: number
  data: Omit<MandarinVocabMultipleChoiceData, 'correct_option'> | Omit<MandarinSentenceOrderData, 'correct_order'>
}

export interface MandarinLessonDetail {
  id: string
  slug: string
  title: string
  objective: string | null
  is_demo_content: boolean
  vocab: MandarinVocabItem[]
  grammar: MandarinGrammarPoint[]
  examples: MandarinExample[]
  exercises: MandarinExercisePublic[]
}

export interface MandarinUserProgress {
  lesson_id: string
  status: MandarinProgressStatus
  completed_at: string | null
}
