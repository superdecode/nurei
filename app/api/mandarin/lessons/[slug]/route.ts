import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLessonDetailBySlug } from '@/lib/supabase/queries/mandarin'

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const supabase = await createServerSupabaseClient()
    const lesson = await getLessonDetailBySlug(supabase, slug)
    if (!lesson) return NextResponse.json({ error: 'Lección no encontrada' }, { status: 404 })
    return NextResponse.json({ data: lesson })
  } catch {
    return NextResponse.json({ error: 'Error al obtener la lección' }, { status: 500 })
  }
}
