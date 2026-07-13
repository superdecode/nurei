'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CrmTabs } from '@/components/admin/crm/CrmTabs'
import { CrmStatsBar } from '@/components/admin/crm/CrmStatsBar'
import { KanbanBoard } from '@/components/admin/crm/KanbanBoard'
import { DealDialog } from '@/components/admin/crm/DealDialog'
import type { CrmBoard, CrmDeal, CrmStats } from '@/types'

export default function PipelinePage() {
  const [board, setBoard] = useState<CrmBoard | null>(null)
  const [stats, setStats] = useState<CrmStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingDeal, setEditingDeal] = useState<CrmDeal | null>(null)
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>(undefined)

  const loadBoard = useCallback(async () => {
    const res = await fetch('/api/admin/crm/board')
    if (res.ok) {
      const json = await res.json()
      setBoard(json.data)
    }
  }, [])

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/crm/stats')
    if (res.ok) {
      const json = await res.json()
      setStats(json.data)
    }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([loadBoard(), loadStats()])
  }, [loadBoard, loadStats])

  useEffect(() => {
    // loading starts true; flip it off after the first load resolves.
    // Subsequent refresh() calls (button, post-mutation) keep the board visible.
    let active = true
    void (async () => {
      await refresh()
      if (active) setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [refresh])

  const stages = board?.columns.map((c) => c.stage) ?? []

  const openNewDeal = (stageId?: string) => {
    setEditingDeal(null)
    setDefaultStageId(stageId)
    setDialogOpen(true)
  }

  const openEditDeal = (deal: CrmDeal) => {
    setEditingDeal(deal)
    setDefaultStageId(undefined)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">CRM · Pipeline</h1>
          <p className="text-sm text-gray-500">Gestiona tus oportunidades de venta</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refresh()} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizar
          </Button>
          <Button size="sm" onClick={() => openNewDeal()} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Nueva oportunidad
          </Button>
        </div>
      </div>

      <CrmTabs />
      <CrmStatsBar stats={stats} loading={loading} />

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-96 w-72 shrink-0 animate-pulse rounded-2xl bg-gray-50" />
          ))}
        </div>
      ) : board ? (
        <KanbanBoard
          columns={board.columns}
          onAddDeal={openNewDeal}
          onOpenDeal={openEditDeal}
          onChanged={refresh}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center text-sm text-gray-500">
          No hay pipeline configurado.
        </div>
      )}

      <DealDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={refresh}
        stages={stages}
        deal={editingDeal}
        defaultStageId={defaultStageId}
      />
    </div>
  )
}
