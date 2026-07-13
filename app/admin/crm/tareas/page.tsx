'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, ListTodo, Check, Clock, Trash2, User, Building2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CrmTabs } from '@/components/admin/crm/CrmTabs'
import { TaskDialog } from '@/components/admin/crm/TaskDialog'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils/format'
import type { CrmTask, CrmTaskPriority } from '@/types'

const PRIORITY_STYLE: Record<CrmTaskPriority, string> = {
  low: 'bg-gray-100 text-gray-500',
  medium: 'bg-sky-50 text-sky-600',
  high: 'bg-amber-50 text-amber-600',
  urgent: 'bg-rose-50 text-rose-600',
}
const PRIORITY_LABEL: Record<CrmTaskPriority, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
  urgent: 'Urgente',
}

type Filter = 'open' | 'done' | 'all'

export default function TareasPage() {
  const [tasks, setTasks] = useState<CrmTask[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('open')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CrmTask | null>(null)

  const load = useCallback(async (f: Filter) => {
    setLoading(true)
    try {
      const url = new URL('/api/admin/crm/tasks', window.location.origin)
      url.searchParams.set('status', f === 'all' ? 'all' : f === 'done' ? 'done' : 'open')
      const res = await fetch(url.toString())
      if (res.ok) {
        const json = await res.json()
        setTasks(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(filter)
  }, [filter, load])

  const toggleDone = async (task: CrmTask) => {
    const next = task.status === 'done' ? 'todo' : 'done'
    const res = await fetch(`/api/admin/crm/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (res.ok) load(filter)
    else toast.error('No se pudo actualizar')
  }

  const handleDelete = async (task: CrmTask) => {
    if (!confirm(`¿Eliminar la tarea "${task.title}"?`)) return
    const res = await fetch(`/api/admin/crm/tasks/${task.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Tarea eliminada')
      load(filter)
    } else toast.error('No se pudo eliminar')
  }

  const isOverdue = (task: CrmTask) =>
    task.status !== 'done' && task.due_at != null && new Date(task.due_at) < new Date()

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">CRM · Tareas</h1>
          <p className="text-sm text-gray-500">Seguimientos y pendientes</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setDialogOpen(true)
          }}
          className="gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nueva tarea
        </Button>
      </div>

      <CrmTabs />

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
        {(['open', 'done', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {f === 'open' ? 'Pendientes' : f === 'done' ? 'Completadas' : 'Todas'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-50" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <ListTodo className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">Sin tareas en esta vista</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={cn(
                'group flex items-start gap-3 rounded-xl border bg-white p-3',
                isOverdue(task) ? 'border-rose-100' : 'border-gray-100',
              )}
            >
              <button
                aria-label={task.status === 'done' ? 'Marcar como pendiente' : 'Marcar como completada'}
                onClick={() => toggleDone(task)}
                className={cn(
                  'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors',
                  task.status === 'done'
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-gray-300 hover:border-emerald-400',
                )}
              >
                {task.status === 'done' ? <Check className="h-3 w-3" /> : null}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn('truncate text-sm font-medium', task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900')}>
                    {task.title}
                  </p>
                  <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold', PRIORITY_STYLE[task.priority])}>
                    {PRIORITY_LABEL[task.priority]}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                  {task.due_at ? (
                    <span className={cn('flex items-center gap-1', isOverdue(task) && 'font-medium text-rose-500')}>
                      {isOverdue(task) ? <AlertTriangle className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {formatRelativeTime(task.due_at)}
                    </span>
                  ) : null}
                  {task.customer ? (
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {task.customer.full_name || task.customer.email}
                    </span>
                  ) : null}
                  {task.company ? (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {task.company.name}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => {
                    setEditing(task)
                    setDialogOpen(true)
                  }}
                  className="rounded-lg px-2 py-1 text-[11px] font-medium text-gray-500 hover:bg-gray-100"
                >
                  Editar
                </button>
                <button
                  aria-label={`Eliminar tarea ${task.title}`}
                  onClick={() => handleDelete(task)}
                  className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={() => load(filter)} task={editing} />
    </div>
  )
}
