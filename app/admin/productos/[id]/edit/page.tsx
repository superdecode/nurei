'use client'

import { use, useEffect, useState } from 'react'
import { fetchWithCredentials } from '@/lib/http/fetch-with-credentials'
import { Loader2 } from 'lucide-react'
import ProductForm from '@/components/admin/productos/ProductForm'
import type { Product, ProductVariant } from '@/types'

interface ProductStub { id: string; name: string }

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
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
          fetchWithCredentials('/api/products'),
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

  const currentIndex = navList.findIndex((p) => p.id === id)
  const navProps = navList.length > 1 ? {
    prev: currentIndex > 0 ? navList[currentIndex - 1] : null,
    next: currentIndex >= 0 && currentIndex < navList.length - 1 ? navList[currentIndex + 1] : null,
    current: currentIndex + 1,
    total: navList.length,
  } : undefined

  return <ProductForm initialProduct={product} initialVariants={variants} navProps={navProps} />
}
