/**
 * Resuelve nombre para usuario interno evitando usar correos como nombre.
 * Prioridad: user_profiles.full_name -> auth metadata -> customers.
 */
export function resolveInternalUserDisplayName(input: {
  profileFullName?: string | null
  authMetaFullName?: string | null
  authMetaName?: string | null
  email?: string | null
  customer?: {
    full_name?: string | null
    first_name?: string | null
    last_name?: string | null
  } | null
}): string {
  const isValidName = (v: unknown): v is string => {
    if (typeof v !== 'string') return false
    const s = v.trim()
    if (!s) return false
    if (s.includes('@')) return false
    return true
  }

  const candidates: Array<string | null | undefined> = [
    input.profileFullName,
    input.authMetaFullName,
    input.authMetaName,
    [input.customer?.first_name, input.customer?.last_name].filter(Boolean).join(' ').trim(),
    input.customer?.full_name,
  ]

  for (const c of candidates) {
    if (isValidName(c)) return c.trim()
  }

  const emailLocal = String(input.email ?? '').split('@')[0]?.trim() ?? ''
  if (!emailLocal) return ''

  const pretty = emailLocal
    .replace(/[._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!pretty) return ''

  return pretty
    .split(' ')
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim()
}
