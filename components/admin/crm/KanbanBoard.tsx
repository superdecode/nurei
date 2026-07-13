'use client'

import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useDroppable } from '@dnd-kit/core'
import { toast } from 'sonner'
import { Plus, GripVertical, Building2, User } from 'lucide-react'
import { formatPrice } from '@/lib/utils/format'
import { cn } from '@/lib/utils'
import type { CrmBoardColumn, CrmDeal, CrmStage } from '@/types'

interface Props {
  columns: CrmBoardColumn[]
  onAddDeal: (stageId: string) => void
  onOpenDeal: (deal: CrmDeal) => void
  onChanged: () => void
}

type ColumnMap = Record<string, CrmDeal[]>

export function KanbanBoard({ columns, onAddDeal, onOpenDeal, onChanged }: Props) {
  const stages = useMemo(() => columns.map((c) => c.stage), [columns])
  const [colMap, setColMap] = useState<ColumnMap>(() =>
    Object.fromEntries(columns.map((c) => [c.stage.id, c.deals])),
  )
  const [activeDeal, setActiveDeal] = useState<CrmDeal | null>(null)

  // Re-sync when the server board changes (refetch)
  const signature = columns.map((c) => `${c.stage.id}:${c.deals.map((d) => d.id).join(',')}`).join('|')
  const [lastSignature, setLastSignature] = useState(signature)
  if (signature !== lastSignature) {
    setColMap(Object.fromEntries(columns.map((c) => [c.stage.id, c.deals])))
    setLastSignature(signature)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const findStageOfDeal = (dealId: string): string | null => {
    for (const [stageId, deals] of Object.entries(colMap)) {
      if (deals.some((d) => d.id === dealId)) return stageId
    }
    return null
  }

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    const stageId = findStageOfDeal(id)
    const deal = stageId ? colMap[stageId].find((d) => d.id === id) : null
    setActiveDeal(deal ?? null)
  }

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    const fromStage = findStageOfDeal(activeId)
    // over can be a column (stage id) or a card (deal id)
    const toStage = colMap[overId] ? overId : findStageOfDeal(overId)
    if (!fromStage || !toStage || fromStage === toStage) return

    setColMap((prev) => {
      const fromDeals = [...prev[fromStage]]
      const toDeals = [...prev[toStage]]
      const movingIndex = fromDeals.findIndex((d) => d.id === activeId)
      if (movingIndex === -1) return prev
      const [moving] = fromDeals.splice(movingIndex, 1)
      const overIndex = toDeals.findIndex((d) => d.id === overId)
      const insertAt = overIndex >= 0 ? overIndex : toDeals.length
      toDeals.splice(insertAt, 0, moving)
      return { ...prev, [fromStage]: fromDeals, [toStage]: toDeals }
    })
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDeal(null)
    if (!over) return
    const activeId = String(active.id)
    const overId = String(over.id)

    const targetStage = colMap[overId] ? overId : findStageOfDeal(overId)
    if (!targetStage) return

    // Reorder within the target column and capture the final order from inside
    // the updater — reading colMap after setColMap would be stale (the state
    // update is async), which would persist the wrong card ordering.
    let orderedIds: string[] = []
    setColMap((prev) => {
      const deals = [...(prev[targetStage] ?? [])]
      const from = deals.findIndex((d) => d.id === activeId)
      const to = colMap[overId] ? deals.length - 1 : deals.findIndex((d) => d.id === overId)
      if (from !== -1 && to !== -1 && from !== to) {
        const [moving] = deals.splice(from, 1)
        deals.splice(to, 0, moving)
      }
      orderedIds = deals.map((d) => d.id)
      return { ...prev, [targetStage]: deals }
    })

    // Guarantee the dragged deal is part of the persisted ordering
    if (!orderedIds.includes(activeId)) orderedIds.push(activeId)

    try {
      const res = await fetch(`/api/admin/crm/deals/${activeId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_id: targetStage, ordered_ids: orderedIds }),
      })
      if (!res.ok) throw new Error('No se pudo mover')
      onChanged()
    } catch {
      toast.error('No se pudo mover la oportunidad')
      onChanged()
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <Column
            key={stage.id}
            stage={stage}
            deals={colMap[stage.id] ?? []}
            onAddDeal={onAddDeal}
            onOpenDeal={onOpenDeal}
          />
        ))}
      </div>
      <DragOverlay>{activeDeal ? <DealCardView deal={activeDeal} dragging /> : null}</DragOverlay>
    </DndContext>
  )
}

function Column({
  stage,
  deals,
  onAddDeal,
  onOpenDeal,
}: {
  stage: CrmStage
  deals: CrmDeal[]
  onAddDeal: (stageId: string) => void
  onOpenDeal: (deal: CrmDeal) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id })
  const total = deals.reduce((s, d) => s + (d.amount_cents ?? 0), 0)

  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="text-sm font-semibold text-gray-800">{stage.name}</span>
          <span className="rounded-full bg-gray-100 px-1.5 text-[11px] font-medium text-gray-500 tabular-nums">
            {deals.length}
          </span>
        </div>
        <span className="text-[11px] font-medium text-gray-400 tabular-nums">{formatPrice(total)}</span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-1 flex-col gap-2 rounded-2xl border border-dashed p-2 transition-colors',
          isOver ? 'border-primary-cyan/60 bg-primary-cyan/5' : 'border-gray-200 bg-gray-50/50',
        )}
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <SortableDeal key={deal.id} deal={deal} onOpen={onOpenDeal} />
          ))}
        </SortableContext>

        <button
          type="button"
          onClick={() => onAddDeal(stage.id)}
          className="flex items-center justify-center gap-1 rounded-xl border border-dashed border-gray-200 py-2 text-xs font-medium text-gray-400 transition-colors hover:border-primary-cyan/50 hover:text-primary-cyan"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </div>
    </div>
  )
}

function SortableDeal({ deal, onOpen }: { deal: CrmDeal; onOpen: (deal: CrmDeal) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: deal.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style}>
      <DealCardView deal={deal} onOpen={onOpen} dragHandleProps={{ ...attributes, ...listeners }} />
    </div>
  )
}

function DealCardView({
  deal,
  onOpen,
  dragHandleProps,
  dragging,
}: {
  deal: CrmDeal
  onOpen?: (deal: CrmDeal) => void
  dragHandleProps?: Record<string, unknown>
  dragging?: boolean
}) {
  return (
    <div
      className={cn(
        'group rounded-xl border border-gray-100 bg-white p-3 shadow-sm',
        dragging ? 'rotate-1 shadow-lg' : 'hover:border-gray-200 hover:shadow',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={() => onOpen?.(deal)}
          className="min-w-0 flex-1 text-left"
        >
          <p className="truncate text-sm font-semibold text-gray-900">{deal.title}</p>
        </button>
        <span
          className="mt-0.5 cursor-grab touch-none text-gray-300 opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          {...dragHandleProps}
        >
          <GripVertical className="h-4 w-4" />
        </span>
      </div>

      <p className="mt-1 text-sm font-bold text-gray-800 tabular-nums">{formatPrice(deal.amount_cents)}</p>

      {(deal.customer || deal.company) && (
        <div className="mt-2 flex flex-col gap-1">
          {deal.customer ? (
            <span className="flex items-center gap-1.5 truncate text-[11px] text-gray-500">
              <User className="h-3 w-3 shrink-0" />
              {deal.customer.full_name || deal.customer.email || deal.customer.phone}
            </span>
          ) : null}
          {deal.company ? (
            <span className="flex items-center gap-1.5 truncate text-[11px] text-gray-500">
              <Building2 className="h-3 w-3 shrink-0" />
              {deal.company.name}
            </span>
          ) : null}
        </div>
      )}
    </div>
  )
}
