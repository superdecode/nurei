import { trimShippingFormFields, type ShippingForm } from '@/lib/types/checkout-shipping'

const STORAGE_KEY = 'nurei-checkout-shipping-v1'

type StoredShape = {
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  neighborhood: string
  city: string
  state: string
  zipCode: string
  country: string
}

function toStored(form: ShippingForm): StoredShape {
  return {
    firstName: form.firstName,
    lastName: form.lastName,
    email: form.email,
    phone: form.phone,
    address: form.address,
    neighborhood: form.neighborhood,
    city: form.city,
    state: form.state,
    zipCode: form.zipCode,
    country: form.country,
  }
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

export function loadShippingDraft(): Partial<ShippingForm> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return null
    return {
      firstName: typeof parsed.firstName === 'string' ? parsed.firstName : undefined,
      lastName: typeof parsed.lastName === 'string' ? parsed.lastName : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      phone: typeof parsed.phone === 'string' ? parsed.phone : undefined,
      address: typeof parsed.address === 'string' ? parsed.address : undefined,
      neighborhood: typeof parsed.neighborhood === 'string' ? parsed.neighborhood : undefined,
      city: typeof parsed.city === 'string' ? parsed.city : undefined,
      state: typeof parsed.state === 'string' ? parsed.state : undefined,
      zipCode: typeof parsed.zipCode === 'string' ? parsed.zipCode : undefined,
      country: typeof parsed.country === 'string' ? parsed.country : undefined,
    }
  } catch {
    return null
  }
}

export function saveShippingDraft(form: ShippingForm) {
  if (typeof window === 'undefined') return
  try {
    const t = trimShippingFormFields(form)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toStored(t)))
  } catch {
    /* ignore quota */
  }
}

export function clearShippingDraft() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

/** Merge stored partial + legacy keys (fullName) into full form */
export function migrateLegacyShippingDraft(
  base: ShippingForm,
  partial: Partial<ShippingForm> | Record<string, unknown> | null
): ShippingForm {
  if (!partial) return base
  const next = { ...base, ...partial } as ShippingForm & { fullName?: string }
  if (typeof next.fullName === 'string' && next.fullName.trim() && !next.firstName && !next.lastName) {
    const p = next.fullName.trim().split(/\s+/)
    return {
      ...next,
      firstName: p[0] ?? '',
      lastName: p.slice(1).join(' '),
    }
  }
  return next
}
