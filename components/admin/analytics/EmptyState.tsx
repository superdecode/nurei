'use client'

import { BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  message?: string
  className?: string
}

export function EmptyState({ message = 'Sin datos para el período seleccionado', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-gray-400', className)}>
      <BarChart3 size={32} className="mb-3 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  )
}
