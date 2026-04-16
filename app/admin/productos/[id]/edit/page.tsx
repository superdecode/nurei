'use client'

import { use, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import ProductForm from '@/components/admin/productos/ProductForm'
import type { Product, ProductVariant } from '@/types'

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/products/${id}`)
        if (!res.ok) throw new Error('Producto no encontrado')
        const json = await res.json()
        setProduct(json.data)
        setVariants(json.data.variants ?? [])
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

  return <ProductForm initialProduct={product} initialVariants={variants} />
}
