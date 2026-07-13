'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { KanbanSquare, Building2, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/admin/crm/pipeline', label: 'Pipeline', icon: KanbanSquare },
  { href: '/admin/crm/empresas', label: 'Empresas', icon: Building2 },
  { href: '/admin/crm/tareas', label: 'Tareas', icon: ListTodo },
]

export function CrmTabs() {
  const pathname = usePathname()
  return (
    <div className="flex gap-1 rounded-xl bg-gray-100 p-1 w-fit">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
