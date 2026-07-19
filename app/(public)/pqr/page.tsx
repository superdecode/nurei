'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageSquare, Send, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Container } from '@/components/layout/Container'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useAuthStore } from '@/lib/stores/auth'
import type { PqrType } from '@/types'

const TIPO_OPTIONS: Array<{ value: PqrType; label: string; hint: string }> = [
  { value: 'peticion', label: 'Petición', hint: 'Solicitar información o un cambio' },
  { value: 'queja', label: 'Queja', hint: 'Algo no funcionó como esperabas' },
  { value: 'reclamo', label: 'Reclamo', hint: 'Un pedido con un problema concreto' },
  { value: 'sugerencia', label: 'Sugerencia', hint: 'Una idea para mejorar' },
]

export default function PqrPage() {
  const { user, email, isAuthenticated } = useAuthStore()

  const [tipo, setTipo] = useState<PqrType>('peticion')
  const [asunto, setAsunto] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [clienteNombre, setClienteNombre] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [ticketNumber, setTicketNumber] = useState<string | null>(null)

  useEffect(() => {
    if (isAuthenticated) {
      if (email) setClienteEmail(email)
      if (user?.full_name) setClienteNombre(user.full_name)
    }
  }, [isAuthenticated, email, user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asunto.trim() || !mensaje.trim() || !clienteEmail.trim()) {
      toast.error('Completa asunto, mensaje y correo')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/pqr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo,
          asunto: asunto.trim(),
          mensaje: mensaje.trim(),
          cliente_email: clienteEmail.trim(),
          cliente_nombre: clienteNombre.trim() || undefined,
        }),
      })
      const json = (await res.json()) as { data?: { ticket_number: string; access_token: string }; error?: string }
      if (!res.ok || !json.data) {
        toast.error(json.error ?? 'No se pudo enviar tu mensaje')
        return
      }
      setTicketNumber(json.data.ticket_number)
    } catch {
      toast.error('Error de conexión, intenta de nuevo')
    } finally {
      setSubmitting(false)
    }
  }

  if (ticketNumber) {
    return (
      <Container>
        <div className="max-w-lg mx-auto py-20 text-center space-y-5">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Recibimos tu mensaje</h1>
          <p className="text-gray-500">
            Te enviamos un correo de confirmación a <strong>{clienteEmail}</strong>. Guarda tu folio de seguimiento:
          </p>
          <p className="font-mono text-lg font-black text-primary-dark bg-gray-50 border border-gray-200 rounded-xl py-3">
            {ticketNumber}
          </p>
          <Link href="/" className="inline-block">
            <Button variant="outline" className="rounded-full">Volver al inicio</Button>
          </Link>
        </div>
      </Container>
    )
  }

  return (
    <Container>
      <div className="max-w-lg mx-auto py-14">
        <div className="text-center mb-8 space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-yellow-50 text-nurei-cta flex items-center justify-center mx-auto">
            <MessageSquare className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black text-gray-900">Peticiones, quejas y reclamos</h1>
          <p className="text-gray-500 text-sm">
            Cuéntanos qué pasó — un miembro de nuestro equipo te responderá directamente a tu correo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="pqr-tipo" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Tipo</label>
            <Select value={tipo} onValueChange={(v) => setTipo((v as PqrType) ?? 'peticion')}>
              <SelectTrigger id="pqr-tipo" className="h-11">
                <SelectValue>{(v: string) => TIPO_OPTIONS.find((o) => o.value === v)?.label ?? 'Tipo'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label} — {o.hint}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label htmlFor="pqr-asunto" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Asunto</label>
            <Input id="pqr-asunto" value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder="Resumen breve de tu caso" className="h-11" maxLength={200} required />
          </div>

          <div>
            <label htmlFor="pqr-mensaje" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Mensaje</label>
            <Textarea id="pqr-mensaje" value={mensaje} onChange={(e) => setMensaje(e.target.value)} placeholder="Cuéntanos con detalle qué pasó" className="min-h-[140px]" maxLength={4000} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="pqr-nombre" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Tu nombre</label>
              <Input id="pqr-nombre" value={clienteNombre} onChange={(e) => setClienteNombre(e.target.value)} placeholder="Opcional" className="h-11" maxLength={200} />
            </div>
            <div>
              <label htmlFor="pqr-email" className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5 block">Tu correo</label>
              <Input id="pqr-email" type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className="h-11" required />
            </div>
          </div>

          <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl font-bold gap-2">
            <Send className="w-4 h-4" /> {submitting ? 'Enviando…' : 'Enviar mensaje'}
          </Button>
        </form>
      </div>
    </Container>
  )
}
