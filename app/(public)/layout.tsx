import { Header } from '@/components/layout/Header'
import { ConditionalFooter } from '@/components/layout/ConditionalFooter'
import { CartDrawer } from '@/components/carrito/CartDrawer'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <ConditionalFooter />
      <CartDrawer />
    </>
  )
}
