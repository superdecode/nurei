import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLessonDetailBySlug, getLessonGlobalPosition, getVocabAudioMap } from '@/lib/supabase/queries/mandarin'
import { LessonPlayer } from './LessonPlayer'

export default async function MandarinLessonPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerSupabaseClient()
  const lesson = await getLessonDetailBySlug(supabase, slug)
  if (!lesson) notFound()

  const [{ data: { user } }, lessonPosition, vocabAudioMap] = await Promise.all([
    supabase.auth.getUser(),
    getLessonGlobalPosition(supabase, slug),
    getVocabAudioMap(supabase),
  ])

  return (
    <LessonPlayer
      lesson={lesson}
      isAuthenticated={Boolean(user)}
      lessonPosition={lessonPosition}
      vocabAudioMap={vocabAudioMap}
    />
  )
}
