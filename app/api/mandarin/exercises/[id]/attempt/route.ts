import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getExerciseById, recordExerciseAttempt } from '@/lib/supabase/queries/mandarin'
import { evaluateExercise } from '@/lib/mandarin/evaluate-exercise'
import { mandarinExerciseAttemptSchema } from '@/lib/validations/mandarin'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
    }

    const parsed = mandarinExerciseAttemptSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const exercise = await getExerciseById(supabase, id)
    if (!exercise) return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 })

    const isCorrect = evaluateExercise(exercise.type, exercise.data, parsed.data.response)
    await recordExerciseAttempt(supabase, user.id, exercise.id, isCorrect, parsed.data.response)

    return NextResponse.json({ data: { is_correct: isCorrect } })
  } catch {
    return NextResponse.json({ error: 'Error al evaluar el ejercicio' }, { status: 500 })
  }
}
