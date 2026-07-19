import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'
import { createPqrTicket } from '@/lib/supabase/queries/pqr'
import { createPqrSchema } from '@/lib/validations/pqr'
import { sendPqrCreatedEmails } from '@/lib/email/send-pqr-emails'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`pqr-create:${ip}`, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un momento.' }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = createPqrSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: parsed.error.flatten() },
        { status: 400 }
      )
    }
    const payload = parsed.data

    const supabaseSession = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabaseSession.auth.getUser()

    const supabase = createServiceClient()

    // Only link to an existing customer record — never create one just for
    // asking a question (unlike orders, a PQR shouldn't mint a new customer).
    let customerId: string | null = null
    if (user) {
      const { data } = await supabase.from('customers').select('id').eq('user_id', user.id).maybeSingle()
      customerId = data?.id ?? null
    } else {
      const { data } = await supabase
        .from('customers')
        .select('id')
        .eq('email', payload.cliente_email.toLowerCase().trim())
        .maybeSingle()
      customerId = data?.id ?? null
    }

    // If an order_id was provided, confirm it actually belongs to this
    // requester (by user_id, or by email for guests) before linking it —
    // otherwise anyone could attach their PQR to someone else's order.
    let orderId: string | null = null
    if (payload.order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('id, user_id, customer_email')
        .eq('id', payload.order_id)
        .maybeSingle()
      const belongsToRequester = order && (
        (user && order.user_id === user.id) ||
        (!user && order.customer_email?.toLowerCase() === payload.cliente_email.toLowerCase().trim())
      )
      if (belongsToRequester) orderId = order.id
    }

    const ticket = await createPqrTicket(supabase, {
      tipo: payload.tipo,
      asunto: payload.asunto,
      mensaje: payload.mensaje,
      cliente_email: payload.cliente_email.toLowerCase().trim(),
      cliente_nombre: payload.cliente_nombre ?? null,
      order_id: orderId,
      user_id: user?.id ?? null,
      customer_id: customerId,
    })

    let orderShortId: string | null = null
    if (ticket.order_id) {
      const { data: order } = await supabase
        .from('orders')
        .select('short_id')
        .eq('id', ticket.order_id)
        .maybeSingle()
      orderShortId = order?.short_id ?? null
    }

    await sendPqrCreatedEmails({
      id: ticket.id,
      ticket_number: ticket.ticket_number,
      tipo: ticket.tipo,
      prioridad: ticket.prioridad,
      asunto: ticket.asunto,
      mensaje: ticket.mensaje,
      cliente_nombre: ticket.cliente_nombre,
      cliente_email: ticket.cliente_email,
      order_short_id: orderShortId,
    })

    return NextResponse.json({
      data: { ticket_number: ticket.ticket_number, access_token: ticket.access_token },
    })
  } catch (err) {
    console.error('[pqr] create failed:', err)
    return NextResponse.json({ error: 'No se pudo enviar tu mensaje. Intenta de nuevo.' }, { status: 500 })
  }
}
