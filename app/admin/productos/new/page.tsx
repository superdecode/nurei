'use client'

import ProductForm from '@/components/admin/productos/ProductForm'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdminTabsStore } from '@/lib/stores/adminTabsStore'

export default function NewProductPage() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { tabs, setDirty } = useAdminTabsStore()
  const currentTabParam = searchParams.get('tab') ?? ''
  const query = searchParams.toString()
  const fullHref = query ? `${pathname}?${query}` : pathname
  const draftStorageKey = useMemo(() => `new-product-${currentTabParam}-${Math.random().toString(36).slice(2)}`, [currentTabParam])
  const [saveSmart, setSaveSmart] = useState<null | (() => Promise<void>)>(null)
  const [savingFromHeader, setSavingFromHeader] = useState(false)

  const getNextTabNumber = useCallback(() => {
    const nums = tabs
      .map((t) => {
        const [path, qs] = t.href.split('?')
        if (path !== '/admin/productos/new') return null
        const p = new URLSearchParams(qs ?? '')
        const n = Number(p.get('tab') ?? '1')
        return Number.isFinite(n) ? n : null
      })
      .filter((n): n is number => n !== null)
    return (nums.length ? Math.max(...nums) : 0) + 1
  }, [tabs])

  useEffect(() => {
    if (currentTabParam) return
    const next = getNextTabNumber()
    router.replace(`/admin/productos/new?tab=${next}`)
  }, [currentTabParam, getNextTabNumber, router])

  const openAnotherGlobalTab = () => {
    const next = getNextTabNumber()
    router.push(`/admin/productos/new?tab=${next}`)
  }
  const handleDirtyChange = useCallback((dirty: boolean) => {
    setDirty(fullHref, dirty)
  }, [fullHref, setDirty])
  const handleRegisterSmartSave = useCallback((fn: (() => Promise<void>) | null) => {
    setSaveSmart(() => fn)
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-dark">Nuevo producto</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            onClick={() => {
              if (!saveSmart) return
              setSavingFromHeader(true)
              void saveSmart().finally(() => setSavingFromHeader(false))
            }}
            disabled={savingFromHeader || !saveSmart}
            className="rounded-xl h-9 text-xs font-bold bg-yellow-400 text-gray-900 hover:bg-yellow-500"
          >
            {savingFromHeader ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
            Guardar
          </Button>
          <Button type="button" onClick={openAnotherGlobalTab} className="rounded-xl h-9 text-xs font-bold bg-primary-dark text-white hover:bg-black">
            <Plus className="h-3.5 w-3.5 mr-1" /> Crear otro producto
          </Button>
        </div>
      </div>
      {currentTabParam ? (
        <ProductForm
          draftStorageKey={draftStorageKey}
          onDirtyChange={handleDirtyChange}
          registerSmartSave={handleRegisterSmartSave}
        />
      ) : null}
    </div>
  )
}
