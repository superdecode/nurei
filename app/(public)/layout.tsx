import { Suspense } from 'react'
import { Header } from '@/components/layout/Header'
import { ConditionalFooter } from '@/components/layout/ConditionalFooter'
import { CartDrawer } from '@/components/carrito/CartDrawer'
import { ReferralTracker } from '@/components/ReferralTracker'
import { StoreCheckoutProvider } from '@/components/providers/StoreCheckoutProvider'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <StoreCheckoutProvider>
      <Suspense fallback={null}>
        <ReferralTracker />
      </Suspense>
      <Header />
      <main className="flex-1">{children}</main>
      <ConditionalFooter />
      <CartDrawer />
    </StoreCheckoutProvider>
  )
}
