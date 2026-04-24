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
  const activeRef = useRef<HTMLButtonElement>(null)
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
    if (!activeRef.current || !scrollRef.current) return
    const container = scrollRef.current
    const button = activeRef.current
    const btnLeft = button.offsetLeft
    const btnRight = btnLeft + button.offsetWidth
    const visLeft = container.scrollLeft + 32
    const visRight = container.scrollLeft + container.offsetWidth - 32
    if (btnLeft >= visLeft && btnRight <= visRight) return
    const scrollLeft = btnLeft - container.offsetWidth / 2 + button.offsetWidth / 2
    container.scrollTo({ left: scrollLeft, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToActive()
  }, [selected, scrollToActive])

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
              const catColor = cat.color

              return (
                <motion.button
                  key={cat.value}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => onChange(cat.value)}
                  whileTap={{ scale: 0.95 }}
                  style={
                    isActive
                      ? undefined
                      : catColor
                      ? { backgroundColor: `${catColor}18`, borderColor: `${catColor}55`, color: catColor }
                      : undefined
                  }
                  className={cn(
                    'relative flex-shrink-0 flex items-center gap-1.5 px-4 sm:px-5 min-h-[44px] rounded-full text-sm font-medium transition-all duration-300 border',
                    isActive
                      ? 'text-gray-900 bg-nurei-cta border-nurei-cta font-bold shadow-md'
                      : catColor
                      ? ''
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
