import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { updateTask, deleteTask } from '@/lib/supabase/queries/crm'
import { updateTaskSchema } from '@/lib/validations/crm'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const body = await request.json()
    const parsed = updateTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    const task = await updateTask(supabase, id, parsed.data, auth.userId)
    return NextResponse.json({ data: task })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error actualizando tarea'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { id } = await params

  try {
    const supabase = createServiceClient()
    await deleteTask(supabase, id)
    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error eliminando tarea'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
