import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdminPermission } from '@/lib/server/require-admin-permission'
import { getPqrTicketById, updatePqrTicket } from '@/lib/supabase/queries/pqr'
import { sendPqrReplyEmail } from '@/lib/email/send-pqr-emails'
import { pqrEstadoEnum, pqrPrioridadEnum } from '@/lib/validations/pqr'
import { z } from 'zod'

const updatePqrBodySchema = z.object({
  estado: pqrEstadoEnum.optional(),
  prioridad: pqrPrioridadEnum.optional(),
  respuesta: z.string().trim().min(1).max(4000).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminPermission('pqr', 'lectura')
  if (guard.error) return guard.error

  try {
    const { id } = await params
    const supabase = createServiceClient()
    const ticket = await getPqrTicketById(supabase, id)
    if (!ticket) return NextResponse.json({ error: 'PQR no encontrado' }, { status: 404 })
    return NextResponse.json({ data: ticket })
  } catch {
    return NextResponse.json({ error: 'Error al cargar el PQR' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdminPermission('pqr', 'escritura')
  if (guard.error) return guard.error

  try {
    const { id } = await params
    const body = await request.json()
    const parsed = updatePqrBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const ticket = await updatePqrTicket(supabase, id, parsed.data)

    if (parsed.data.respuesta) {
      await sendPqrReplyEmail({
        id: ticket.id,
        ticket_number: ticket.ticket_number,
        asunto: ticket.asunto,
        respuesta: ticket.respuesta ?? parsed.data.respuesta,
        estado: ticket.estado,
        cliente_email: ticket.cliente_email,
      })
    }

    return NextResponse.json({ data: ticket })
  } catch (err) {
    console.error('[pqr] update failed:', err)
    return NextResponse.json({ error: 'Error al actualizar el PQR' }, { status: 500 })
  }
}
