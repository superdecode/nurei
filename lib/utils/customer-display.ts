import type { Customer } from '@/types'

type NameFields = Pick<Customer, 'full_name' | 'first_name' | 'last_name' | 'email' | 'phone' | 'company_name'>

/** Human-readable name for CRM / admin UI (handles email-only signups). */
export function customerDisplayName(c: NameFields): string {
  const fn = (c.first_name ?? '').trim()
  const ln = (c.last_name ?? '').trim()
  if (fn || ln) return [fn, ln].filter(Boolean).join(' ').trim()
  const full = (c.full_name ?? '').trim()
  if (full) return full
  if (c.company_name?.trim()) return c.company_name.trim()
  if (c.phone?.trim()) return c.phone.trim()
  // No usar el correo como "nombre" en CRM: el email se muestra en su propia fila.
  return 'Sin nombre'
}

export function customerToFirstLast(c: NameFields): { first_name: string; last_name: string } {
  const fn = (c.first_name ?? '').trim()
  const ln = (c.last_name ?? '').trim()
  if (fn || ln) return { first_name: fn, last_name: ln }
  const full = (c.full_name ?? '').trim()
  if (full) {
    const parts = full.split(/\s+/).filter(Boolean)
    return {
      first_name: parts[0] ?? '',
      last_name: parts.slice(1).join(' '),
    }
  }
  const local = c.email?.split('@')[0]?.replace(/[.+_-]/g, ' ').trim()
  if (local) return { first_name: local, last_name: '' }
  return { first_name: '', last_name: '' }
}
