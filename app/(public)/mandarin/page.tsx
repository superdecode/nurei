import { createServerSupabaseClient } from '@/lib/supabase/server'
import { MandarinDashboard } from './MandarinDashboard'

interface LessonRow {
  slug: string
  title: string
  objective: string | null
  order_index: number
}

interface UnitRow {
  title: string
  order_index: number
  mandarin_lessons: LessonRow[]
}

interface LevelRow {
  title: string
  order_index: number
  mandarin_units: UnitRow[]
}

interface LessonCard {
  slug: string
  title: string
  objective: string | null
  levelTitle: string
}

export default async function MandarinPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: levels } = await supabase
    .from('mandarin_levels')
    .select('title, order_index, mandarin_units(title, order_index, mandarin_lessons(slug, title, objective, order_index))')
    .eq('is_published', true)
    .order('order_index')
    .returns<LevelRow[]>()

  let completedSlugs: string[] = []
  if (user) {
    const { data: progress } = await supabase
      .from('mandarin_user_progress')
      .select('lesson_id, status, mandarin_lessons!inner(slug)')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .returns<{ lesson_id: string; status: string; mandarin_lessons: { slug: string } }[]>()
    completedSlugs = (progress ?? [])
      .map((row) => row.mandarin_lessons?.slug)
      .filter((slug): slug is string => Boolean(slug))
  }

  const levels_ = (levels ?? []).map((level) => ({
    title: level.title,
    units: [...level.mandarin_units]
      .sort((a, b) => a.order_index - b.order_index)
      .map((unit) => ({
        title: unit.title,
        lessons: [...unit.mandarin_lessons].sort((a, b) => a.order_index - b.order_index),
      })),
  }))

  const lessons: LessonCard[] = levels_.flatMap((level) =>
    level.units.flatMap((unit) =>
      unit.lessons.map((lesson) => ({
        slug: lesson.slug,
        title: lesson.title,
        objective: lesson.objective,
        levelTitle: level.title,
      }))
    )
  )

  const levelNames = levels_.map((level) => level.title)

  return (
    <MandarinDashboard
      isAuthenticated={Boolean(user)}
      lessons={lessons}
      levelNames={levelNames}
      completedSlugs={completedSlugs}
    />
  )
}
