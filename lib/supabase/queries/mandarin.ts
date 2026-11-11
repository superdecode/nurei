import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  MandarinLessonDetail,
  MandarinExercisePublic,
  MandarinExerciseType,
  MandarinUserProgress,
  MandarinProgressStatus,
} from '@/types/mandarin'

export async function getLessonDetailBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<MandarinLessonDetail | null> {
  const { data: lesson, error: lessonError } = await supabase
    .from('mandarin_lessons')
    .select('id, slug, title, objective, is_demo_content')
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()
  if (lessonError) throw lessonError
  if (!lesson) return null

  const [{ data: lessonVocab, error: vocabError }, { data: grammar, error: grammarError },
    { data: examples, error: examplesError }, { data: exercises, error: exercisesError }] =
    await Promise.all([
      supabase
        .from('mandarin_lesson_vocab')
        .select('order_index, mandarin_vocab_items(id, hanzi, pinyin, es, notes, audio_url, example_hanzi, example_pinyin, example_es)')
        .eq('lesson_id', lesson.id)
        .order('order_index'),
      supabase
        .from('mandarin_grammar_points')
        .select('id, title, explanation, order_index')
        .eq('lesson_id', lesson.id)
        .order('order_index'),
      supabase
        .from('mandarin_examples')
        .select('id, hanzi, pinyin, es, order_index, audio_url')
        .eq('lesson_id', lesson.id)
        .order('order_index'),
      supabase
        .from('mandarin_exercises')
        .select('id, type, prompt, order_index')
        .eq('lesson_id', lesson.id)
        .eq('is_published', true)
        .order('order_index'),
    ])
  if (vocabError) throw vocabError
  if (grammarError) throw grammarError
  if (examplesError) throw examplesError
  if (exercisesError) throw exercisesError

  // `data` (correct_option/correct_order) is locked down at the column-grant
  // level for anon/authenticated (see migration
  // 20260907220531_mandarin_exercises_answer_lockdown.sql), so it must be
  // fetched via the security definer RPC instead of selecting it directly.
  const exerciseIds = (exercises ?? []).map((exercise) => exercise.id)
  const { data: exerciseData, error: exerciseDataError } = exerciseIds.length
    ? await supabase.rpc('mandarin_get_exercises_data', { p_exercise_ids: exerciseIds })
    : { data: [] as { id: string; data: unknown }[], error: null }
  if (exerciseDataError) throw exerciseDataError
  const dataById = new Map((exerciseData ?? []).map((row: { id: string; data: unknown }) => [row.id, row.data]))
  const exercisesWithData = (exercises ?? []).map((exercise) => ({
    ...exercise,
    data: (dataById.get(exercise.id) ?? {}) as Record<string, unknown>,
  }))

  return {
    id: lesson.id,
    slug: lesson.slug,
    title: lesson.title,
    objective: lesson.objective,
    is_demo_content: lesson.is_demo_content,
    vocab: (lessonVocab ?? []).map((row) => {
      const item = row.mandarin_vocab_items as unknown as {
        id: string; hanzi: string; pinyin: string; es: string; notes: string | null; audio_url: string | null
        example_hanzi: string | null; example_pinyin: string | null; example_es: string | null
      }
      return item
    }),
    grammar: grammar ?? [],
    examples: examples ?? [],
    exercises: exercisesWithData.map(stripCorrectAnswer),
  }
}

export async function getVocabAudioMap(supabase: SupabaseClient): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('mandarin_vocab_items')
    .select('hanzi, audio_url')
    .not('audio_url', 'is', null)
  if (error) throw error

  const map: Record<string, string> = {}
  for (const row of data ?? []) {
    if (row.audio_url) map[row.hanzi] = row.audio_url
  }
  return map
}

export async function getLessonGlobalPosition(
  supabase: SupabaseClient,
  slug: string
): Promise<{ index: number; total: number; nextLesson: { slug: string; title: string } | null } | null> {
  const { data: levels, error } = await supabase
    .from('mandarin_levels')
    .select('order_index, mandarin_units(order_index, mandarin_lessons(slug, title, order_index))')
    .eq('is_published', true)
    .order('order_index')
    .returns<
      {
        order_index: number
        mandarin_units: { order_index: number; mandarin_lessons: { slug: string; title: string; order_index: number }[] }[]
      }[]
    >()
  if (error) throw error

  const orderedLessons = (levels ?? []).flatMap((level) =>
    [...level.mandarin_units]
      .sort((a, b) => a.order_index - b.order_index)
      .flatMap((unit) =>
        [...unit.mandarin_lessons].sort((a, b) => a.order_index - b.order_index).map((lesson) => ({ slug: lesson.slug, title: lesson.title }))
      )
  )

  const index = orderedLessons.findIndex((lesson) => lesson.slug === slug)
  if (index === -1) return null
  const next = orderedLessons[index + 1] ?? null
  return { index: index + 1, total: orderedLessons.length, nextLesson: next }
}

function stripCorrectAnswer(exercise: {
  id: string
  type: MandarinExerciseType
  prompt: string
  data: Record<string, unknown>
  order_index: number
}): MandarinExercisePublic {
  const { correct_option: _correctOption, correct_order: _correctOrder, ...publicData } = exercise.data as {
    correct_option?: string
    correct_order?: number[]
    [key: string]: unknown
  }
  return {
    id: exercise.id,
    type: exercise.type,
    prompt: exercise.prompt,
    order_index: exercise.order_index,
    data: publicData as MandarinExercisePublic['data'],
  }
}

export async function getExerciseById(
  supabase: SupabaseClient,
  id: string
): Promise<{ id: string; type: MandarinExerciseType; lesson_id: string; data: unknown } | null> {
  // `data` (which carries correct_option/correct_order) is locked down at the
  // column-grant level for anon/authenticated (see migration
  // 20260907220531_mandarin_exercises_answer_lockdown.sql), so it must be
  // fetched via the security definer RPC instead of selecting it directly.
  const [{ data: meta, error: metaError }, { data: rawData, error: dataError }] = await Promise.all([
    supabase
      .from('mandarin_exercises')
      .select('id, type, lesson_id')
      .eq('id', id)
      .eq('is_published', true)
      .maybeSingle(),
    supabase.rpc('mandarin_get_exercise_data', { p_exercise_id: id }),
  ])
  if (metaError) throw metaError
  if (dataError) throw dataError
  if (!meta) return null
  return { ...meta, data: rawData }
}

export async function getUserProgressForLesson(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string
): Promise<MandarinUserProgress | null> {
  const { data, error } = await supabase
    .from('mandarin_user_progress')
    .select('lesson_id, status, completed_at')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function upsertLessonProgress(
  supabase: SupabaseClient,
  userId: string,
  lessonId: string,
  status: MandarinProgressStatus
): Promise<void> {
  const { error } = await supabase.from('mandarin_user_progress').upsert({
    user_id: userId,
    lesson_id: lessonId,
    status,
    completed_at: status === 'completed' ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

export async function recordExerciseAttempt(
  supabase: SupabaseClient,
  userId: string,
  exerciseId: string,
  isCorrect: boolean,
  response: unknown
): Promise<void> {
  const { error } = await supabase.from('mandarin_user_exercise_attempts').insert({
    user_id: userId,
    exercise_id: exerciseId,
    is_correct: isCorrect,
    response,
  })
  if (error) throw error
}
