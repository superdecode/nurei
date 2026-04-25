'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'


interface CategoryFilterProps {
  selected: string
  onChange: (category: string) => void
  categoriesOverride?: { value: string; label: string; emoji: string; color?: string }[]
}

export function CategoryFilter({ selected, onChange, categoriesOverride }: CategoryFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [categories, setCategories] = useState<{value: string, label: string, emoji: string, color?: string}[]>([
    { value: 'all', label: 'Todo', emoji: '✨' }
  ])

  useEffect(() => {
    if (categoriesOverride && categoriesOverride.length > 0) {
      setCategories(categoriesOverride)
      return
    }
    fetch('/api/admin/categories')
      .then(r => r.json())
      .then(json => {
        if (json.data) {
          const dbCats = json.data.map((c: any) => ({
            value: c.slug,
            label: c.name ? c.name.charAt(0).toUpperCase() + c.name.slice(1) : c.slug,
            emoji: c.emoji || '🍜',
            color: c.color ?? undefined,
          }))
          setCategories([{ value: 'all', label: 'Todo', emoji: '✨' }, ...dbCats])
        }
      })
      .catch()
  }, [categoriesOverride])

  const scrollToActive = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>('button[data-category-chip]')
    )
    const button = buttons.find((el) => el.dataset.categoryChip === selected)
    if (!button) return

    const targetLeft = button.offsetLeft - (container.clientWidth - button.clientWidth) / 2
    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth)
    const clampedLeft = Math.min(maxScrollLeft, Math.max(0, targetLeft))

    container.scrollTo({ left: clampedLeft, behavior: 'smooth' })
  }, [selected])

  useEffect(() => {
    scrollToActive()
  }, [selected, categories, scrollToActive])

  return (
    <div className="sticky top-16 z-40 bg-background/80 backdrop-blur-md border-b">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative">
          {/* Left fade */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background/90 to-transparent z-10 sm:hidden" />
          {/* Right fade */}
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background/90 to-transparent z-10 sm:hidden" />

          <div
            ref={scrollRef}
            className="flex flex-nowrap gap-2 overflow-x-auto py-3 sm:py-4 px-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {categories.map((cat) => {
              const isActive = selected === cat.value

              return (
                <motion.button
                  key={cat.value}
                  data-category-chip={cat.value}
                  onClick={() => onChange(cat.value)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'relative flex-shrink-0 flex items-center gap-1.5 px-4 sm:px-5 min-h-[44px] rounded-full text-sm font-medium transition-all duration-300 border',
                    isActive
                      ? 'text-gray-900 bg-nurei-cta border-nurei-cta font-bold shadow-md'
                      : 'bg-white border-gray-100 text-gray-500 hover:text-gray-900 hover:border-yellow-300 hover:bg-yellow-50'
                  )}
                >
                  <span className="text-base leading-none">{cat.emoji}</span>
                  <span>{cat.label}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
