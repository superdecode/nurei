import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Guest ticket lookup: folio + the unguessable access_token returned when the
 * ticket was created (mirrors orders' public_access_token pattern). Folio
 * numbers are sequential and therefore guessable on their own, so the token
 * — not the customer's email — is what actually gates access here.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ ticketNumber: string }> }
) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`pqr-lookup:${ip}`, 10, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un momento.' }, { status: 429 })
  }

  const { ticketNumber } = await params
  const token = request.nextUrl.searchParams.get('token')?.trim()
  if (!token || !UUID_RE.test(token)) {
    return NextResponse.json({ error: 'Falta el token de seguimiento del PQR' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('pqr_tickets')
    .select('ticket_number, tipo, estado, prioridad, asunto, mensaje, respuesta, created_at, resuelto_at')
    .eq('ticket_number', ticketNumber)
    .eq('access_token', token)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'No encontramos un PQR con ese folio y token' }, { status: 404 })
  }

  return NextResponse.json({ data })
}
