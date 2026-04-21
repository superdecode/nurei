/**
 * Resolves nombre/apellido para afiliados: prioridad affiliate_profiles → user_profiles.full_name → customers.
 * No usa el correo como nombre.
 */
export function resolveAffiliateFirstLast(
  affiliateRow: {
    first_name?: string | null
    last_name?: string | null
  },
  userProfile: { full_name?: string | null } | null | undefined,
  customer: {
    first_name?: string | null
    last_name?: string | null
    full_name?: string | null
  } | null | undefined
): { first_name: string; last_name: string } {
  let firstName = String(affiliateRow.first_name ?? '').trim()
  let lastName = String(affiliateRow.last_name ?? '').trim()

  if (!firstName && !lastName && userProfile?.full_name) {
    const raw = String(userProfile.full_name).trim()
    if (raw) {
      const parts = raw.split(/\s+/).filter(Boolean)
      firstName = parts[0] ?? ''
      lastName = parts.slice(1).join(' ')
    }
  }

  if (!firstName && !lastName && customer) {
    const fn = String(customer.first_name ?? '').trim()
    const ln = String(customer.last_name ?? '').trim()
    if (fn || ln) {
      firstName = fn
      lastName = ln
    } else if (customer.full_name) {
      const raw = String(customer.full_name).trim()
      if (raw) {
        const parts = raw.split(/\s+/).filter(Boolean)
        firstName = parts[0] ?? ''
        lastName = parts.slice(1).join(' ')
      }
    }
  }

  return { first_name: firstName, last_name: lastName }
}
