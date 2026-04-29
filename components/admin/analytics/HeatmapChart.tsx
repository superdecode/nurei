'use client'

import { cn } from '@/lib/utils'

interface HeatmapChartProps {
  data: number[][]
  rowLabels: string[]
  colLabels: string[]
  format?: (v: number) => string
  colorScale?: [string, string]
  className?: string
}

function interpolateColor(low: string, high: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
  const lo = parse(low)
  const hi = parse(high)
  const r = Math.round(lo[0] + (hi[0] - lo[0]) * t)
  const g = Math.round(lo[1] + (hi[1] - lo[1]) * t)
  const b = Math.round(lo[2] + (hi[2] - lo[2]) * t)
  return `rgb(${r},${g},${b})`
}

export function HeatmapChart({
  data,
  rowLabels,
  colLabels,
  format = (v) => `${v}%`,
  colorScale = ['#F0FDF4', '#10B981'],
  className,
}: HeatmapChartProps) {
  const allValues = data.flat().filter((v) => v > 0)
  const maxVal = allValues.length > 0 ? Math.max(...allValues) : 100

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            <th className="p-1.5 text-left text-gray-500 font-medium w-24">Cohorte</th>
            {colLabels.map((label) => (
              <th key={label} className="p-1.5 text-center text-gray-500 font-medium min-w-[48px]">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rowLabels.map((row, ri) => (
            <tr key={row}>
              <td className="p-1.5 text-gray-600 font-medium whitespace-nowrap">{row}</td>
              {colLabels.map((_, ci) => {
                const val = data[ri]?.[ci] ?? 0
                const t = maxVal > 0 ? val / maxVal : 0
                const bg = val > 0 ? interpolateColor(colorScale[0], colorScale[1], t) : '#F8FAFC'
                const textColor = t > 0.6 ? 'white' : '#374151'
                return (
                  <td
                    key={ci}
                    className="p-1.5 text-center rounded"
                    style={{ backgroundColor: bg, color: textColor }}
                  >
                    {val > 0 ? format(val) : '-'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
