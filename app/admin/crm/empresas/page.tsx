'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Search, Building2, Users, Briefcase, Pencil, Trash2, Globe, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CrmTabs } from '@/components/admin/crm/CrmTabs'
import { CompanyDialog } from '@/components/admin/crm/CompanyDialog'
import { formatPrice } from '@/lib/utils/format'
import type { CrmCompany } from '@/types'

export default function EmpresasPage() {
  const [companies, setCompanies] = useState<CrmCompany[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<CrmCompany | null>(null)

  const load = useCallback(async (term: string) => {
    setLoading(true)
    try {
      const url = new URL('/api/admin/crm/companies', window.location.origin)
      if (term) url.searchParams.set('search', term)
      const res = await fetch(url.toString())
      if (res.ok) {
        const json = await res.json()
        setCompanies(json.data ?? [])
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => load(search), 250)
    return () => clearTimeout(t)
  }, [search, load])

  const handleDelete = async (company: CrmCompany) => {
    if (!confirm(`¿Eliminar la empresa "${company.name}"?`)) return
    const res = await fetch(`/api/admin/crm/companies/${company.id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Empresa eliminada')
      load(search)
    } else {
      toast.error('No se pudo eliminar')
    }
  }

  return (
    <div className="space-y-5 p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">CRM · Empresas</h1>
          <p className="text-sm text-gray-500">Organizaciones B2B y sus oportunidades</p>
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
          Nueva empresa
        </Button>
      </div>

      <CrmTabs />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empresa..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-gray-50" />
          ))}
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-10 text-center">
          <Building2 className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">No hay empresas todavía</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {companies.map((company) => (
            <div key={company.id} className="group rounded-2xl border border-gray-100 bg-white p-4 transition-shadow hover:shadow-sm">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-cyan/10 text-sm font-bold text-primary-dark">
                    {company.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{company.name}</p>
                    {company.industry ? <p className="truncate text-xs text-gray-400">{company.industry}</p> : null}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    aria-label={`Editar ${company.name}`}
                    onClick={() => {
                      setEditing(company)
                      setDialogOpen(true)
                    }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    aria-label={`Eliminar ${company.name}`}
                    onClick={() => handleDelete(company)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500">
                {company.phone ? (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {company.phone}
                  </span>
                ) : null}
                {company.website ? (
                  <span className="flex items-center gap-1 truncate">
                    <Globe className="h-3 w-3" />
                    {company.website.replace(/^https?:\/\//, '')}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex items-center gap-4 border-t border-gray-50 pt-3 text-xs">
                <span className="flex items-center gap-1 text-gray-500">
                  <Users className="h-3.5 w-3.5" />
                  {company.contacts_count ?? 0} contactos
                </span>
                <span className="flex items-center gap-1 text-gray-500">
                  <Briefcase className="h-3.5 w-3.5" />
                  {company.deals_count ?? 0} deals
                </span>
                {(company.open_deals_value_cents ?? 0) > 0 ? (
                  <span className="ml-auto font-semibold text-emerald-600 tabular-nums">
                    {formatPrice(company.open_deals_value_cents ?? 0)}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      <CompanyDialog open={dialogOpen} onClose={() => setDialogOpen(false)} onSaved={() => load(search)} company={editing} />
    </div>
  )
}
