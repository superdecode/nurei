'use client'

import {
  forwardRef,
  useLayoutEffect,
  useState,
  type RefObject,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  anchorRef: RefObject<HTMLElement | null>
  children: ReactNode
  className?: string
  /** max width in px (default 320) */
  maxWidth?: number
}

/**
 * Renders filter UI in a portal with fixed position so parent overflow:hidden never clips it.
 * Forward ref points at the panel root for click-outside handling alongside the anchor ref.
 */
export const AnchoredFilterPanel = forwardRef<HTMLDivElement, Props>(function AnchoredFilterPanel(
  { open, anchorRef, children, className, maxWidth = 320 },
  panelRef,
) {
  const [box, setBox] = useState({ top: 0, left: 0, width: maxWidth })

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return
    const el = anchorRef.current
    const update = () => {
      const r = el.getBoundingClientRect()
      const w = Math.min(maxWidth, window.innerWidth - 16)
      let left = r.left
      if (left + w > window.innerWidth - 8) left = window.innerWidth - 8 - w
      if (left < 8) left = 8
      const maxH = Math.min(window.innerHeight * 0.72, 520)
      let top = r.bottom + 8
      if (top + maxH > window.innerHeight - 8 && r.top > maxH + 16) {
        top = Math.max(8, r.top - maxH - 8)
      } else if (top + maxH > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - 8 - maxH)
      }
      setBox({ top, left, width: w })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [open, anchorRef, maxWidth])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panelRef}
          initial={{ opacity: 0, y: 6, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className={cn(
            'fixed z-[200] max-h-[min(72vh,520px)] overflow-y-auto overscroll-contain rounded-2xl border border-gray-200 bg-white shadow-xl',
            className,
          )}
          style={{ top: box.top, left: box.left, width: box.width }}
          role="dialog"
          aria-modal="true"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
})

AnchoredFilterPanel.displayName = 'AnchoredFilterPanel'
