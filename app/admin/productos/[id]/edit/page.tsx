'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import ProductForm from '@/components/admin/productos/ProductForm'
import type { Product, ProductVariant } from '@/types'

interface ProductStub { id: string; name: string }

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [navList, setNavList] = useState<ProductStub[]>([])

  useEffect(() => {
    async function load() {
      try {
        const [productRes, listRes] = await Promise.all([
          fetchWithCredentials(`/api/products/${id}`),
          fetchWithCredentials('/api/products?fields=id,name'),
        ])
        if (!productRes.ok) throw new Error('Producto no encontrado')
        const json = await productRes.json()
        setProduct(json.data)
        setVariants(json.data.variants ?? [])
        if (listRes.ok) {
          const listJson = await listRes.json()
          setNavList((listJson.data?.products ?? []) as ProductStub[])
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error cargando producto')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const currentIndex = navList.findIndex((p) => p.id === id)
  const prevProduct = currentIndex > 0 ? navList[currentIndex - 1] : null
  const nextProduct = currentIndex >= 0 && currentIndex < navList.length - 1 ? navList[currentIndex + 1] : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">{error || 'Producto no encontrado'}</p>
      </div>
    )
  }

  return (
    <div>
      {navList.length > 1 && (
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            type="button"
            onClick={() => prevProduct && router.push(`/admin/productos/${prevProduct.id}/edit`)}
            disabled={!prevProduct}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="max-w-[140px] truncate">{prevProduct?.name ?? 'Anterior'}</span>
          </button>
          <span className="text-xs text-gray-400 tabular-nums">
            {currentIndex >= 0 ? `${currentIndex + 1} / ${navList.length}` : ''}
          </span>
          <button
            type="button"
            onClick={() => nextProduct && router.push(`/admin/productos/${nextProduct.id}/edit`)}
            disabled={!nextProduct}
            className="flex items-center gap-1.5 h-8 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
          >
            <span className="max-w-[140px] truncate">{nextProduct?.name ?? 'Siguiente'}</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <ProductForm initialProduct={product} initialVariants={variants} />
    </div>
  )
}
