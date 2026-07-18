'use client'

import { useEffect, useState } from 'react'
import type { CampaignCtaLink, Category } from '@/types'

interface ProductOption {
  id: string
  name: string
  slug: string
}

interface CtaLinkPickerProps {
  value: CampaignCtaLink | null
  onChange: (link: CampaignCtaLink | null) => void
}

export function CtaLinkPicker({ value, onChange }: CtaLinkPickerProps) {
  const [type, setType] = useState<CampaignCtaLink['type']>(value?.type ?? 'url')
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<ProductOption[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    if (type !== 'product') return
    const timeout = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((json) => setProducts((json.data?.products ?? []).slice(0, 20)))
        .catch(() => setProducts([]))
    }, 300)
    return () => clearTimeout(timeout)
  }, [type, query])

  useEffect(() => {
    if (type !== 'category') return
    fetch('/api/admin/categories')
      .then((r) => r.json())
      .then((json) => setCategories(json.data ?? []))
      .catch(() => setCategories([]))
  }, [type])

  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        {(['url', 'product', 'category'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => { setType(t); onChange(null) }}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
              type === t ? 'bg-primary-dark text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {t === 'url' ? 'URL' : t === 'product' ? 'Producto' : 'Categoría'}
          </button>
        ))}
      </div>

      {type === 'url' && (
        <input
          type="text"
          value={value?.value ?? ''}
          onChange={(e) => onChange({ type: 'url', value: e.target.value })}
          placeholder="/menu o https://..."
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm"
        />
      )}

      {type === 'product' && (
        <div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm"
          />
          {products.length > 0 && (
            <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-gray-100">
              {products.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { onChange({ type: 'product', value: p.slug }); setQuery(p.name) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 ${
                    value?.value === p.slug ? 'bg-amber-50 font-semibold' : ''
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {type === 'category' && (
        <select
          value={value?.value ?? ''}
          onChange={(e) => onChange(e.target.value ? { type: 'category', value: e.target.value } : null)}
          className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm"
        >
          <option value="">Selecciona una categoría</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
      )}
    </div>
  )
}
