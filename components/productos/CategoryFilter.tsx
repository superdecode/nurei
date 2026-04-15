'use client'

import { useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { CATEGORIES } from '@/lib/utils/constants'

const CATEGORY_EMOJI: Record<string, string> = {
  all: '�',
  crunchy: '�',
  spicy: '�️',
  limited_edition: '�',
  drinks: '�',
}

interface CategoryFilterProps {
  selected: string
  onChange: (category: string) => void
}

export function CategoryFilter({ selected, onChange }: CategoryFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLButtonElement>(null)

  const scrollToActive = useCallback(() => {
    if (!activeRef.current || !scrollRef.current) return
    const container = scrollRef.current
    const button = activeRef.current
    const scrollLeft =
      button.offsetLeft - container.offsetWidth / 2 + button.offsetWidth / 2
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
            className="flex gap-2 overflow-x-auto scrollbar-none py-3 sm:py-4 px-1"
          >
            {CATEGORIES.map((cat) => {
              const isActive = selected === cat.value
              const emoji = CATEGORY_EMOJI[cat.value] || '🍘'

              return (
                <motion.button
                  key={cat.value}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => onChange(cat.value)}
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    'relative flex-shrink-0 flex items-center gap-1.5 px-4 sm:px-5 min-h-[44px] rounded-full text-sm font-medium transition-all duration-300 border',
                    isActive
                      ? 'text-white bg-nurei-cta border-nurei-cta font-bold shadow-md'
                      : 'text-gray-500 bg-white border-gray-100 hover:text-gray-900 hover:border-orange-200 hover:bg-orange-50'
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
