import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/server/require-admin'
import { createServiceClient } from '@/lib/supabase/server'
import { listTasks, createTask } from '@/lib/supabase/queries/crm'
import { createTaskSchema } from '@/lib/validations/crm'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const sp = request.nextUrl.searchParams
    const supabase = createServiceClient()
    const tasks = await listTasks(supabase, {
      status: (sp.get('status') as 'todo' | 'in_progress' | 'done' | 'open' | 'all' | null) ?? undefined,
      dealId: sp.get('dealId') ?? undefined,
      customerId: sp.get('customerId') ?? undefined,
      companyId: sp.get('companyId') ?? undefined,
      assigneeId: sp.get('assigneeId') ?? undefined,
    })
    return NextResponse.json({ data: tasks })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error listando tareas'
    return NextResponse.json({ error: message, data: [] }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  try {
    const body = await request.json()
    const parsed = createTaskSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 })
    }
    const supabase = createServiceClient()
    const task = await createTask(supabase, parsed.data, auth.userId)
    return NextResponse.json({ data: task }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error creando tarea'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
