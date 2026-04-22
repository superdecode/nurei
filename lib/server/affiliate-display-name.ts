/**
 * Resolves nombre/apellido para afiliados.
 * Prioridad: affiliate_profiles → customers → user_profiles.full_name.
 * No usa el correo como nombre. Descarta valores que coincidan con el handle.
 */
export function resolveAffiliateFirstLast(
  affiliateRow: {
    first_name?: string | null
    last_name?: string | null
    handle?: string | null
  },
  userProfile: { full_name?: string | null } | null | undefined,
  customer: {
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
  } | null | undefined
): { first_name: string; last_name: string } {
  const handle = (affiliateRow.handle ?? '').toLowerCase().trim()

  // 1. Explícito en affiliate_profiles
  const afFn = String(affiliateRow.first_name ?? '').trim()
  const afLn = String(affiliateRow.last_name ?? '').trim()
  if (afFn || afLn) return { first_name: afFn, last_name: afLn }

  // 2. Customers table (fuente más confiable para usuarios reales)
  if (customer) {
    const fn = String(customer.first_name ?? '').trim()
    const ln = String(customer.last_name ?? '').trim()
    if (fn || ln) return { first_name: fn, last_name: ln }

    const fullCust = String(customer.full_name ?? '').trim()
    if (fullCust && fullCust.toLowerCase() !== handle) {
      const parts = fullCust.split(/\s+/).filter(Boolean)
      return { first_name: parts[0] ?? '', last_name: parts.slice(1).join(' ') }
    }
  }

  // 3. user_profiles.full_name (metadata de auth — menos confiable)
  const fullUp = String(userProfile?.full_name ?? '').trim()
  if (fullUp && fullUp.toLowerCase() !== handle) {
    const parts = fullUp.split(/\s+/).filter(Boolean)
    return { first_name: parts[0] ?? '', last_name: parts.slice(1).join(' ') }
  }

  return { first_name: '', last_name: '' }
}
