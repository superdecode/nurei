import type { CampaignContent, CampaignTemplateKey } from '@/types'

export interface CampaignTemplate {
  templateKey: CampaignTemplateKey
  name: string
  description: string
  subject: string
  preheader: string
  content: CampaignContent
}

const EMPTY_CONTENT: CampaignContent = {
  heading: '',
  body: '',
  imageUrl: null,
  ctaLabel: '',
  ctaLink: null,
  couponCode: null,
}

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    templateKey: 'bienvenida',
    name: 'Bienvenida',
    description: 'Para clientes nuevos — su primera compra.',
    subject: '¡Bienvenido a nurei! 🎉',
    preheader: 'Un regalito para tu primer pedido',
    content: {
      heading: '¡Qué gusto tenerte aquí!',
      body: 'Gracias por unirte a nurei. Explora nuestros snacks asiáticos favoritos y arma tu primer pedido — te va a encantar.',
      imageUrl: null,
      ctaLabel: 'Ver catálogo',
      ctaLink: { type: 'url', value: '/menu' },
      couponCode: null,
    },
  },
  {
    templateKey: 'winback',
    name: 'Te extrañamos',
    description: 'Para clientes que no compran hace tiempo.',
    subject: 'Te extrañamos por acá 🥺',
    preheader: 'Vuelve por tus snacks favoritos',
    content: {
      heading: 'Hace tiempo no te vemos',
      body: 'Han llegado sabores nuevos desde tu última visita. Dale un vistazo, seguro encuentras algo que te encante.',
      imageUrl: null,
      ctaLabel: 'Volver a la tienda',
      ctaLink: { type: 'url', value: '/menu' },
      couponCode: null,
    },
  },
  {
    templateKey: 'promo',
    name: 'Promo + cupón',
    description: 'Descuento o promoción de temporada.',
    subject: 'Oferta especial solo por tiempo limitado',
    preheader: 'No te lo pierdas',
    content: {
      heading: 'Una promo pensada para ti',
      body: 'Usa tu cupón en tu próxima compra antes de que se acabe.',
      imageUrl: null,
      ctaLabel: 'Comprar ahora',
      ctaLink: { type: 'url', value: '/menu' },
      couponCode: null,
    },
  },
  {
    templateKey: 'blank',
    name: 'En blanco',
    description: 'Empieza desde cero.',
    subject: '',
    preheader: '',
    content: { ...EMPTY_CONTENT },
  },
]

export function getTemplate(key: CampaignTemplateKey): CampaignTemplate {
  const found = CAMPAIGN_TEMPLATES.find((t) => t.templateKey === key)
  if (!found) throw new Error(`Unknown campaign template: ${key}`)
  return found
}
