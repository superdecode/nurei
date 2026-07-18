import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { renderCampaignEmailHtml } from '@/lib/email/templates/campaign-email-html'
import {
  renderAdminNewOrderHtml,
  renderCustomerOrderConfirmationHtml,
  renderOrderDeliveredHtml,
  renderOrderPreparingHtml,
  renderOrderRefundedHtml,
  renderOrderShippedHtml,
} from '@/lib/email/templates/order-emails-html'
import { EmailPreviewStudio, type EmailPreview } from './EmailPreviewStudio'

export const metadata: Metadata = {
  title: 'Email Studio · Nurei',
  robots: { index: false, follow: false },
}

const orderBase = {
  brandName: 'Nurei',
  shortId: 'NUR-11001',
  customerName: 'Elian Quiroga',
  orderUrl: 'http://localhost:3500/pedido/33909770-fcdb-4f64-ba02-5bc5f760b2b8?token=preview',
  orderDate: '18 jul 2026',
  total: 68900,
  deliveryAddress: 'Av. Álvaro Obregón 123, Roma Norte, Cuauhtémoc, 06700, México',
}

function createPreviews(): EmailPreview[] {
  const items = [
    { name: 'Samyang Buldak Carbonara', quantity: 2, subtotal: 35800 },
    { name: 'Pocky Matcha', quantity: 1, subtotal: 14900 },
    { name: 'Ramune Original', quantity: 1, subtotal: 9900 },
  ]

  return [
    {
      id: 'order-confirmation',
      group: 'Pedidos',
      label: 'Pedido recibido',
      subject: '¡Tu pedido NUR-11001 está en marcha!',
      description: 'Confirmación inicial con productos, totales y dirección.',
      html: renderCustomerOrderConfirmationHtml({
        ...orderBase,
        items,
        subtotal: 60600,
        shippingFee: 12900,
        couponDiscount: 4600,
        couponCode: 'HOLA10',
        pendingPaymentNote: null,
      }),
    },
    {
      id: 'order-pending-payment',
      group: 'Pedidos',
      label: 'Pago pendiente',
      subject: '¡Tu pedido NUR-11001 está en marcha!',
      description: 'Confirmación con instrucciones para completar el pago.',
      html: renderCustomerOrderConfirmationHtml({
        ...orderBase,
        items,
        subtotal: 60600,
        shippingFee: 12900,
        couponDiscount: 4600,
        couponCode: 'HOLA10',
        pendingPaymentNote: 'Transfiere usando la referencia TR-5BC5F7. Te avisaremos cuando el pago quede acreditado.',
      }),
    },
    {
      id: 'order-preparing',
      group: 'Pedidos',
      label: 'En preparación',
      subject: 'Tu pedido NUR-11001 está siendo preparado',
      description: 'Actualización cuando el equipo comienza a surtirlo.',
      html: renderOrderPreparingHtml({ ...orderBase, estimatedDelivery: '20–22 de julio' }),
    },
    {
      id: 'order-shipped',
      group: 'Pedidos',
      label: 'En camino',
      subject: 'Tu pedido NUR-11001 va en camino',
      description: 'Incluye transportista, guía y dirección de entrega.',
      html: renderOrderShippedHtml({ ...orderBase, trackingNumber: 'EST-84920153', carrier: 'Estafeta', estimatedDelivery: '20 de julio' }),
    },
    {
      id: 'order-delivered',
      group: 'Pedidos',
      label: 'Entregado',
      subject: '¡Tu pedido NUR-11001 fue entregado!',
      description: 'Cierre del ciclo de entrega al cliente.',
      html: renderOrderDeliveredHtml(orderBase),
    },
    {
      id: 'order-refund-partial',
      group: 'Pedidos',
      label: 'Reembolso parcial',
      subject: 'Reembolso procesado: pedido NUR-11001',
      description: 'Detalle de devolución parcial y saldo vigente.',
      html: renderOrderRefundedHtml({ ...orderBase, amountCents: 14900, reason: 'Producto agotado', remainingCents: 54000 }),
    },
    {
      id: 'order-refund-full',
      group: 'Pedidos',
      label: 'Reembolso total',
      subject: 'Reembolso procesado: pedido NUR-11001',
      description: 'Confirmación de devolución completa del pedido.',
      html: renderOrderRefundedHtml({ ...orderBase, amountCents: 68900, reason: 'Cancelación solicitada por el cliente', remainingCents: 0 }),
    },
    {
      id: 'order-admin',
      group: 'Pedidos',
      label: 'Aviso interno',
      subject: '[Nurei] Nuevo pedido NUR-11001 · $689.00',
      description: 'Notificación operativa enviada al equipo administrador.',
      html: renderAdminNewOrderHtml({
        brandName: 'Nurei',
        shortId: 'NUR-11001',
        adminOrderUrl: 'http://localhost:3500/admin/pedidos/33909770-fcdb-4f64-ba02-5bc5f760b2b8',
        customerName: 'Elian Quiroga',
        customerEmail: 'cliente@example.com',
        customerPhone: '+52 55 1234 5678',
        items,
        total: 68900,
        deliveryAddress: orderBase.deliveryAddress,
      }),
    },
    {
      id: 'marketing-welcome',
      group: 'Marketing',
      label: 'Bienvenida',
      subject: 'Bienvenido al lado más rico de Asia',
      description: 'Presentación de marca para nuevos clientes.',
      html: renderCampaignEmailHtml({
        content: {
          heading: 'Tu próxima obsesión empieza aquí',
          body: 'Bienvenido a Nurei, una selección de snacks asiáticos que sí vale la pena descubrir.\nExplora sabores nuevos, ediciones especiales y favoritos difíciles de encontrar.',
          imageUrl: null,
          ctaLabel: 'Explorar el menú',
          ctaLink: { type: 'url', value: 'http://localhost:3500/menu' },
          couponCode: null,
        },
        resolvedCtaUrl: 'http://localhost:3500/menu',
        preheader: 'Descubre la selección Nurei.',
      }),
    },
    {
      id: 'marketing-promo',
      group: 'Marketing',
      label: 'Promoción con cupón',
      subject: 'Un antojo con 15% menos',
      description: 'Campaña comercial con código promocional y CTA.',
      html: renderCampaignEmailHtml({
        content: {
          heading: 'Hoy el antojo tiene descuento',
          body: 'Arma tu selección con ramen, dulces, bebidas y snacks crujientes.\nUsa el código antes de que termine la promoción.',
          imageUrl: null,
          ctaLabel: 'Usar mi descuento',
          ctaLink: { type: 'url', value: 'http://localhost:3500/menu' },
          couponCode: 'NUREI15',
        },
        resolvedCtaUrl: 'http://localhost:3500/menu',
        preheader: '15% de descuento por tiempo limitado.',
      }),
    },
    {
      id: 'marketing-winback',
      group: 'Marketing',
      label: 'Te extrañamos',
      subject: 'Hay nuevos sabores esperándote',
      description: 'Recuperación de clientes que llevan tiempo sin comprar.',
      html: renderCampaignEmailHtml({
        content: {
          heading: 'Mucho cambió desde tu última visita',
          body: 'Llegaron sabores nuevos y regresaron algunos favoritos.\nDate una vuelta: quizá tu próximo snack favorito ya está aquí.',
          imageUrl: null,
          ctaLabel: 'Ver qué llegó',
          ctaLink: { type: 'url', value: 'http://localhost:3500/menu' },
          couponCode: 'VUELVE10',
        },
        resolvedCtaUrl: 'http://localhost:3500/menu',
        preheader: 'Nuevos productos y un detalle para tu regreso.',
      }),
    },
  ]
}

export default function EmailPreviewPage() {
  if (process.env.NODE_ENV !== 'development') notFound()

  return <EmailPreviewStudio previews={createPreviews()} />
}
