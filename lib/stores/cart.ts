'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearShippingDraft } from '@/lib/checkout-shipping-cache'
import { trackAddToCart as trackGa4AddToCart } from '@/lib/tracking/ga4'
import { trackAddToCart as trackMetaAddToCart } from '@/lib/tracking/meta-pixel'
import type { Product, CartItem, ProductVariant } from '@/types'

interface CartStore {
  items: CartItem[]
  cartSessionId: string
  addItem: (product: Product, variant?: Pick<ProductVariant, 'id' | 'name' | 'image' | 'price'> | null) => void
  removeItem: (productId: string, variantId?: string | null) => void
  updateQuantity: (productId: string, quantity: number, variantId?: string | null) => void
  clearCart: () => void
  getSubtotal: () => number
  getTotal: (shippingFee: number, discount?: number) => number
  getItemCount: () => number
}

function cartKey(productId: string, variantId?: string | null): string {
  return variantId ? `${productId}:${variantId}` : productId
}

function itemMatches(item: CartItem, productId: string, variantId?: string | null): boolean {
  if (item.product.id !== productId) return false
  const itemVariantId = item.variant_id ?? null
  const targetVariantId = variantId ?? null
  return itemVariantId === targetVariantId
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      cartSessionId: crypto.randomUUID(),

      addItem: (product: Product, variant?: Pick<ProductVariant, 'id' | 'name' | 'image' | 'price'> | null) => {
        const priceCentavos = variant?.price ?? product.base_price ?? product.price
        trackGa4AddToCart({ id: product.id, name: product.name, category: product.category }, priceCentavos)
        trackMetaAddToCart({ id: product.id, name: product.name }, priceCentavos)

        set((state) => {
          const existing = state.items.find((item) =>
            itemMatches(item, product.id, variant?.id)
          )
          if (existing) {
            return {
              items: state.items.map((item) =>
                itemMatches(item, product.id, variant?.id)
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            }
          }
          const newItem: CartItem = {
            product,
            quantity: 1,
            variant_id: variant?.id ?? null,
            variant_label: variant?.name ?? null,
            variant_image: variant?.image ?? null,
            variant_price: variant?.price ?? null,
          }
          return { items: [...state.items, newItem] }
        })
      },

      removeItem: (productId: string, variantId?: string | null) => {
        set((state) => ({
          items: state.items.filter((item) => !itemMatches(item, productId, variantId)),
        }))
      },

      updateQuantity: (productId: string, quantity: number, variantId?: string | null) => {
        if (quantity <= 0) {
          get().removeItem(productId, variantId)
          return
        }
        set((state) => ({
          items: state.items.map((item) =>
            itemMatches(item, productId, variantId) ? { ...item, quantity } : item
          ),
        }))
      },

      clearCart: () => {
        clearShippingDraft()
        set({ items: [], cartSessionId: crypto.randomUUID() })
      },

      getSubtotal: () => {
        return get().items.reduce((sum, item) => {
          const unitPrice = item.variant_price ?? item.product.base_price ?? item.product.price
          return sum + unitPrice * item.quantity
        }, 0)
      },

      getTotal: (shippingFee: number, discount: number = 0) => {
        return Math.max(0, get().getSubtotal() + shippingFee - discount)
      },

      getItemCount: () => {
        return get().items.reduce((sum, item) => sum + item.quantity, 0)
      },
    }),
    {
      name: 'nurei-cart',
    }
  )
)

export { cartKey }
