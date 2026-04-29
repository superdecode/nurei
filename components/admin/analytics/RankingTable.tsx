'use client'

import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Column<T> {
  key: keyof T
  label: string
  format?: (value: T[keyof T], row: T) => string | React.ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  showBar?: boolean
  barMax?: number
}

interface RankingTableProps<T extends object> {
  data: T[]
  columns: Column<T>[]
  searchable?: boolean
  searchPlaceholder?: string
  pageSize?: number
  className?: string
}

export function RankingTable<T extends object>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = 'Buscar...',
  pageSize = 20,
  className,
}: RankingTableProps<T>) {
  const [sortKey, setSortKey] = useState<keyof T | null>(columns[0]?.key ?? null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      columns.some((col) => String((row as Record<string, unknown>)[col.key as string] ?? '').toLowerCase().includes(q)),
    )
  }, [data, search, columns])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const ar = a as Record<string, unknown>
      const br = b as Record<string, unknown>
      const av = ar[sortKey as string]
      const bv = br[sortKey as string]
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'desc' ? -cmp : cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.ceil(sorted.length / pageSize)
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize)

  const handleSort = (key: keyof T) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
    setPage(1)
  }

  const barMaxMap = useMemo(() => {
    const map = new Map<keyof T, number>()
    for (const col of columns) {
      if (col.showBar) {
        const max = col.barMax ?? Math.max(...data.map((r) => Number((r as Record<string, unknown>)[col.key as string] ?? 0)))
        map.set(col.key, max)
      }
    }
    return map
  }, [data, columns])

  return (
    <div className={cn('w-full', className)}>
      {searchable && (
        <div className="relative mb-3">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-white text-gray-700 placeholder:text-gray-400"
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-100">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {columns.map((col) => (
                <th
                  key={String(col.key)}
                  onClick={() => col.sortable !== false && handleSort(col.key)}
                  className={cn(
                    'px-4 py-3 font-medium text-gray-500 whitespace-nowrap',
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                    col.sortable !== false && 'cursor-pointer select-none hover:text-gray-900',
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable !== false && sortKey === col.key && (
                      sortDir === 'desc' ? <ChevronDown size={11} /> : <ChevronUp size={11} />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                  Sin datos para el período seleccionado
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                  {columns.map((col) => {
                    const raw = (row as Record<string, unknown>)[col.key as string] as T[keyof T]
                    const display = col.format ? col.format(raw, row) : String(raw ?? '')
                    const barMax = barMaxMap.get(col.key)

                    return (
                      <td
                        key={String(col.key)}
                        className={cn(
                          'px-4 py-3 text-gray-700',
                          col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : '',
                        )}
                      >
                        {col.showBar && barMax ? (
                          <div className="flex items-center gap-2">
                            <span className="min-w-[60px] text-right">{display}</span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-amber-400 rounded-full"
                                style={{ width: `${Math.min((Number(raw) / barMax) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        ) : display}
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs text-gray-400">{sorted.length} resultados</span>
          <div className="flex gap-1">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Anterior
            </button>
            <span className="px-3 py-1 text-xs text-gray-600">{page} / {totalPages}</span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
