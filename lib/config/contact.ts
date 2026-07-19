/** Builds a wa.me deep link from an admin-configured contact number and an optional prefilled message. */
export function buildWhatsAppUrl(rawNumber: string, message?: string): string {
  const digits = rawNumber.replace(/[^\d]/g, '')
  const withCountryCode = digits.length === 10 ? `52${digits}` : digits
  const base = `https://wa.me/${withCountryCode}`
  return message ? `${base}?text=${encodeURIComponent(message)}` : base
}
