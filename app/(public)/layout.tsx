import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { ConditionalFooter } from '@/components/layout/ConditionalFooter'
import { CartDrawer } from '@/components/carrito/CartDrawer'
import { CartFlightLayer } from '@/components/carrito/CartFlightLayer'
import { ReferralTracker } from '@/components/ReferralTracker'
import { StoreCheckoutProvider } from '@/components/providers/StoreCheckoutProvider'
import { ConsentProvider } from '@/components/consent/ConsentProvider'
import { ConsentBanner } from '@/components/consent/ConsentBanner'
import { TrackingScripts } from '@/components/tracking/TrackingScripts'
import { WhatsAppFloatingButton } from '@/components/layout/WhatsAppFloatingButton'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ConsentProvider>
      <StoreCheckoutProvider>
        <Suspense fallback={null}>
          <ReferralTracker />
        </Suspense>
        <Header />
        <main className="flex-1">{children}</main>
        <ConditionalFooter />
        <CartDrawer />
        <CartFlightLayer />
        <ConsentBanner />
        <TrackingScripts />
        <WhatsAppFloatingButton />
      </StoreCheckoutProvider>
    </ConsentProvider>
  )
}
