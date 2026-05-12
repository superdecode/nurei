'use client'

import ProductForm from '@/components/admin/productos/ProductForm'
import { useCallback, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAdminTabsStore } from '@/lib/stores/adminTabsStore'

export default function NewProductPage() {
  const pathname = usePathname()
  const router = useRouter()
  const { setDirty } = useAdminTabsStore()
  const fullHref = pathname
  const draftStorageKey = 'new-product'
  const [saveSmart, setSaveSmart] = useState<null | (() => Promise<void>)>(null)
  const [savingFromHeader, setSavingFromHeader] = useState(false)
  const [resetToken, setResetToken] = useState(0)

  const resetDraft = useCallback(() => {
    setDirty(fullHref, false)
    setSaveSmart(null)
    try {
      localStorage.removeItem(`nurei-product-draft:${draftStorageKey}`)
      sessionStorage.removeItem(`nurei-product-draft:${draftStorageKey}`)
    } catch {
      // ignore storage failures
    }
    setResetToken((v) => v + 1)
    router.replace('/admin/productos/new')
  }, [draftStorageKey, fullHref, router, setDirty])

  const handleDirtyChange = useCallback((dirty: boolean) => {
    setDirty(fullHref, dirty)
  }, [fullHref, setDirty])
  const handleRegisterSmartSave = useCallback((fn: (() => Promise<void>) | null) => {
    setSaveSmart(() => fn)
  }, [])

  const saveAndClose = useCallback(async () => {
    if (!saveSmart) return
    setSavingFromHeader(true)
    try {
      await saveSmart()
    } finally {
      setSavingFromHeader(false)
    }
  }, [saveSmart])

  const openAnotherGlobalTab = () => {
    resetDraft()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-primary-dark">Nuevo producto</h1>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            onClick={() => void saveAndClose()}
            disabled={savingFromHeader || !saveSmart}
            className="rounded-xl h-9 text-xs font-bold bg-yellow-400 text-gray-900 hover:bg-yellow-500"
          >
            {savingFromHeader ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
            Guardar
          </Button>
          <Button type="button" onClick={openAnotherGlobalTab} className="rounded-xl h-9 text-xs font-bold bg-primary-dark text-white hover:bg-black">
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Crear otro producto
          </Button>
        </div>
      </div>
      <ProductForm
        key={`${draftStorageKey}-${resetToken}`}
        draftStorageKey={draftStorageKey}
        onDirtyChange={handleDirtyChange}
        registerSmartSave={handleRegisterSmartSave}
      />
    </div>
  )
}
