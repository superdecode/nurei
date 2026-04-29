'use client'

import { cn } from '@/lib/utils'

interface FunnelStage {
  stage: string
  count: number
  drop_off_rate: number | null
  avg_hours_to_next: number | null
}

const STAGE_LABELS: Record<string, string> = {
  pending_payment: 'Pago pendiente',
  paid: 'Pagado',
  preparing: 'Preparando',
  shipped: 'Enviado',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
}

interface FunnelChartProps {
  data: FunnelStage[]
  className?: string
}

export function FunnelChart({ data, className }: FunnelChartProps) {
  const maxCount = data.length > 0 ? Math.max(...data.map((d) => d.count)) : 1

  return (
    <div className={cn('space-y-2', className)}>
      {data.map((stage, i) => {
        const widthPct = maxCount > 0 ? (stage.count / maxCount) * 100 : 0
        return (
          <div key={stage.stage}>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-28 text-xs text-gray-600 text-right shrink-0">
                {STAGE_LABELS[stage.stage] ?? stage.stage}
              </div>
              <div className="flex-1 relative h-9 bg-gray-50 rounded-lg overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-amber-400/80 rounded-lg transition-all"
                  style={{ width: `${widthPct}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-3">
                  <span className="text-xs font-semibold text-gray-800">
                    {stage.count.toLocaleString('es-MX')}
                  </span>
                  {stage.drop_off_rate !== null && stage.drop_off_rate > 0 && (
                    <span className="text-xs text-red-500 font-medium">
                      -{stage.drop_off_rate}%
                    </span>
                  )}
                </div>
              </div>
            </div>
            {i < data.length - 1 && stage.avg_hours_to_next !== null && (
              <div className="ml-[7.5rem] pl-3 text-[10px] text-gray-400 mb-1">
                avg. {stage.avg_hours_to_next}h hasta siguiente etapa
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
