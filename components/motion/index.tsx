'use client'

import { motion, useInView, useScroll, useTransform, type Variants } from 'framer-motion'
import { useRef } from 'react'

// Fade in from bottom (for scroll reveals)
export function FadeIn({ children, delay = 0, className = '', duration = 0.5 }: { children: React.ReactNode; delay?: number; className?: string; duration?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Fade in from specific direction
export function FadeInDirection({ children, delay = 0, className = '', direction = 'up', distance = 30 }: { children: React.ReactNode; delay?: number; className?: string; direction?: 'up' | 'down' | 'left' | 'right'; distance?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  const axes = {
    up: { x: 0, y: distance },
    down: { x: 0, y: -distance },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...axes[direction] }}
      animate={inView ? { opacity: 1, x: 0, y: 0 } : { opacity: 0, ...axes[direction] }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Scale up on scroll
export function ScaleIn({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={inView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Staggered children animation
export function StaggerContainer({ children, className = '', staggerDelay = 0.1 }: { children: React.ReactNode; className?: string; staggerDelay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Floating animation (idle breathing effect)
export function Float({ children, className = '', amplitude = 6, duration = 3 }: { children: React.ReactNode; className?: string; amplitude?: number; duration?: number }) {
  return (
    <motion.div
      animate={{ y: [-amplitude, amplitude, -amplitude] }}
      transition={{ duration, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Pulse glow effect
export function PulseGlow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      animate={{ boxShadow: ['0 0 0px rgba(0,229,255,0)', '0 0 20px rgba(0,229,255,0.4)', '0 0 0px rgba(0,229,255,0)'] }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Parallax scroll effect
export function Parallax({ children, className = '', speed = 0.5 }: { children: React.ReactNode; className?: string; speed?: number }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [0, speed * 100])

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  )
}

// Magnetic hover effect for buttons/CTAs
export function MagneticHover({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Counter animation for numbers
export function AnimatedCounter({ value, className = '' }: { value: number; className?: string }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : { opacity: 0 }}
    >
      {inView ? (
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          {value.toLocaleString('es-MX')}
        </motion.span>
      ) : (
        '0'
      )}
    </motion.span>
  )
}

// Page transition wrapper
export function PageTransition({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0.98 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0.98 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Loading skeleton with shimmer
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`bg-gray-200 rounded-lg ${className}`}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
    />
  )
}

// Product card skeleton
export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 overflow-hidden">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  )
}

// Grid of product skeletons
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  )
}
