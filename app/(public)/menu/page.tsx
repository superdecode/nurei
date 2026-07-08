import { createServerSupabaseClient } from '@/lib/supabase/server'
import { listProducts } from '@/lib/supabase/queries/products'
import { listCategories } from '@/lib/supabase/queries/categories'
import { MenuClient, type MenuCategoryMeta } from './MenuClient'

export const revalidate = 60

export default async function MenuPage() {
  const supabase = await createServerSupabaseClient()

  const [products, dbCategories] = await Promise.all([
    listProducts({ status: 'active' }),
    listCategories(supabase),
  ])

  const categoryOrder = dbCategories.map((c) => c.slug)
  const categoryMeta: Record<string, MenuCategoryMeta> = Object.fromEntries(
    dbCategories.map((c) => [
      c.slug,
      {
        label: c.name ? c.name.charAt(0).toUpperCase() + c.name.slice(1) : c.slug,
        emoji: c.emoji || '🍜',
        color: c.color ?? undefined,
      },
    ]),
  )

  return (
    <MenuClient
      initialProducts={products}
      initialCategoryOrder={categoryOrder}
      initialCategoryMeta={categoryMeta}
    />
  )
}
