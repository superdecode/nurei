'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OrderStatus } from '@/types'

interface TimelineStep {
  status: OrderStatus
  label: string
}

const ALL_STEPS: TimelineStep[] = [
  { status: 'pending', label: 'Pedido recibido' },
  { status: 'confirmed', label: 'Pago confirmado' },
  { status: 'shipped', label: 'Enviado' },
  { status: 'delivered', label: 'Entregado' },
]

const STATUS_ORDER: OrderStatus[] = ['pending', 'confirmed', 'shipped', 'delivered']

interface OrderTimelineProps {
  currentStatus: OrderStatus
  createdAt: string
}

export function OrderTimeline({ currentStatus, createdAt }: OrderTimelineProps) {
  const currentIdx = STATUS_ORDER.indexOf(currentStatus)

  return (
    <div className="space-y-0">
      {ALL_STEPS.map((step, idx) => {
        const stepIdx = STATUS_ORDER.indexOf(step.status)
        const isCompleted = stepIdx < currentIdx
        const isCurrent = step.status === currentStatus
        const isPending = stepIdx > currentIdx
        const isLast = idx === ALL_STEPS.length - 1

        return (
          <div key={step.status} className="flex gap-3 sm:gap-4">
            {/* Line + dot */}
            <div className="flex flex-col items-center">
              <motion.div
                className="relative flex-shrink-0"
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                  delay: idx * 0.15,
                  duration: 0.4,
                  type: 'spring',
                  stiffness: 260,
                  damping: 20,
                }}
              >
                {isCurrent && (
                  <motion.div
                    className="absolute inset-[-4px] rounded-full bg-primary-cyan/30"
                    animate={{
                      scale: [1, 1.6, 1],
                      opacity: [0.5, 0, 0.5],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}

                <div
                  className={cn(
                    'relative w-5 h-5 rounded-full border-2 flex items-center justify-center',
                    isCompleted && 'bg-success border-success',
                    isCurrent && 'bg-primary-cyan border-primary-cyan',
                    isPending && 'bg-white border-gray-300'
                  )}
                >
                  {isCompleted && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: idx * 0.15 + 0.2, type: 'spring', stiffness: 300 }}
                    >
                      <Check className="w-3 h-3 text-white" strokeWidth={3} />
                    </motion.div>
                  )}

                  {isCurrent && (
                    <motion.div
                      className="w-2 h-2 rounded-full bg-white"
                      animate={{ scale: [1, 0.6, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                </div>
              </motion.div>

              {!isLast && (
                <div className="relative w-0.5 h-10 bg-gray-200 overflow-hidden">
                  <motion.div
                    className={cn(
                      'absolute top-0 left-0 w-full',
                      isCompleted || isCurrent ? 'bg-primary-cyan' : 'bg-gray-200'
                    )}
                    initial={{ height: 0 }}
                    animate={{ height: '100%' }}
                    transition={{
                      delay: idx * 0.15 + 0.1,
                      duration: 0.5,
                      ease: 'easeOut',
                    }}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <motion.div
              className="pb-8 min-w-0"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: idx * 0.15 + 0.05,
                duration: 0.4,
                ease: 'easeOut',
              }}
            >
              <p
                className={cn(
                  'text-sm font-semibold -mt-0.5',
                  isCompleted && 'text-success',
                  isCurrent && 'text-primary-cyan',
                  isPending && 'text-gray-400'
                )}
              >
                {step.label}
              </p>
              <motion.p
                className="text-xs text-gray-400 mt-0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: idx * 0.15 + 0.25, duration: 0.3 }}
              >
                {isCompleted
                  ? new Date(createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                  : isCurrent
                    ? 'Ahora'
                    : 'Pendiente de pago'}
              </motion.p>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
