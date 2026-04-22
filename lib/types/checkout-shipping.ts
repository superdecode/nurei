export type ShippingForm = {
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

export const DEFAULT_SHIPPING_FORM: ShippingForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
  country: 'México',
}

export function trimShippingFormFields(form: ShippingForm): ShippingForm {
  return {
    firstName: form.firstName.trim(),
    lastName: form.lastName.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    neighborhood: form.neighborhood.trim(),
    city: form.city.trim(),
    state: form.state.trim(),
    zipCode: form.zipCode.trim(),
    country: form.country.trim(),
  }
}
