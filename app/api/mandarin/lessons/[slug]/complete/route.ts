import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLessonDetailBySlug } from '@/lib/supabase/queries/mandarin'
import { upsertLessonProgress } from '@/lib/supabase/queries/mandarin'

export async function POST(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const lesson = await getLessonDetailBySlug(supabase, slug)
    if (!lesson) return NextResponse.json({ error: 'Lección no encontrada' }, { status: 404 })

    await upsertLessonProgress(supabase, user.id, lesson.id, 'completed')
    return NextResponse.json({ data: { completed: true } })
  } catch {
    return NextResponse.json({ error: 'Error al marcar la lección como completada' }, { status: 500 })
  }
}
