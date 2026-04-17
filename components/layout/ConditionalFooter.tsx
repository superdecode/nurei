'use client'

import { usePathname } from 'next/navigation'
import { Footer } from './Footer'

export function ConditionalFooter() {
  const pathname = usePathname()
  const hideOnMobile = /^(\/producto\/|\/menu)/.test(pathname)
  if (hideOnMobile) return <div className="hidden sm:block"><Footer /></div>
  return <Footer />
}
