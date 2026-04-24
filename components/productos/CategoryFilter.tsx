'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'


interface CategoryFilterProps {
  selected: string
  onChange: (category: string) => void
  categoriesOverride?: { value: string; label: string; emoji: string }[]
}

export function CategoryFilter({ selected, onChange, categoriesOverride }: CategoryFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)
  const [categories, setCategories] = useState<{value: string, label: string, emoji: string}[]>([
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
            label: c.name,
            emoji: c.emoji || '🍜'
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
            {categories.map((cat, idx) => {
              const isActive = selected === cat.value
              const emoji = cat.emoji
              const palette = [
                'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100',
                'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100',
                'bg-violet-50 border-violet-200 text-violet-800 hover:bg-violet-100',
                'bg-sky-50 border-sky-200 text-sky-800 hover:bg-sky-100',
                'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100',
                'bg-orange-50 border-orange-200 text-orange-800 hover:bg-orange-100',
                'bg-pink-50 border-pink-200 text-pink-800 hover:bg-pink-100',
                'bg-teal-50 border-teal-200 text-teal-800 hover:bg-teal-100',
              ]
              const inactiveColor = idx === 0 ? 'bg-white border-gray-100 text-gray-500 hover:text-gray-900 hover:border-yellow-300 hover:bg-yellow-50' : palette[(idx - 1) % palette.length]

              return (
                <motion.button
                  key={cat.value}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => onChange(cat.value)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'relative flex-shrink-0 flex items-center gap-1.5 px-4 sm:px-5 min-h-[44px] rounded-full text-sm font-medium transition-all duration-300 border',
                    isActive
                      ? 'text-gray-900 bg-nurei-cta border-nurei-cta font-bold shadow-md'
                      : inactiveColor
                  )}
                >
                  <span className="text-base leading-none">
                    {emoji}
                  </span>
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
