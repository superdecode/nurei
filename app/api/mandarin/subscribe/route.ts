import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { rateLimit, getClientIp } from '@/lib/server/rate-limit'
import { mandarinSubscribeSchema } from '@/lib/validations/mandarin'

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers)
  const rl = rateLimit(`mandarin-subscribe:${ip}`, 5, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Demasiadas solicitudes. Intenta en un momento.' }, { status: 429 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const parsed = mandarinSubscribeSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos inválidos', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.warn('[mandarin] RESEND_API_KEY no configurada — omitiendo notificación.')
    return NextResponse.json({ data: { subscribed: true } })
  }

  const notifyEmail = process.env.MANDARIN_NOTIFY_EMAIL?.trim()
  if (!notifyEmail) {
    console.warn('[mandarin] MANDARIN_NOTIFY_EMAIL no configurada — omitiendo notificación.')
    return NextResponse.json({ data: { subscribed: true } })
  }

  const from = process.env.EMAIL_FROM ?? 'nurei <onboarding@resend.dev>'
  const resend = new Resend(apiKey)
  const { email } = parsed.data

  try {
    const { error } = await resend.emails.send({
      from,
      to: [notifyEmail],
      replyTo: email,
      subject: 'Nuevo interesado — curso de mandarín (elianxchina)',
      html: `<p>Nuevo correo interesado en el curso de chino mandarín:</p><p><strong>${email}</strong></p>`,
    })
    if (error) {
      console.error('[mandarin] Resend rechazó la notificación:', error)
    }
  } catch (err) {
    console.error('[mandarin] Error enviando notificación:', err)
  }

  return NextResponse.json({ data: { subscribed: true } })
}
