'use client'

import { useState } from 'react'
import Papa from 'papaparse'
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { mapTrackingCsvRow, type TrackingCsvRow } from '@/lib/utils/csv-tracking-mapper'

type ParsedRow = TrackingCsvRow

type ImportSummary = {
  total: number
  updated: number
  notFound: string[]
  notShippable: Array<{ folio: string; detail?: string }>
  errors: Array<{ folio: string; detail?: string }>
  emailsSent: number
}

interface Props {
  open: boolean
  onClose: () => void
  onImported: () => void
}

export function BulkTrackingImportModal({ open, onClose, onImported }: Props) {
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [invalidCount, setInvalidCount] = useState(0)
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const reset = () => {
    setRows([])
    setInvalidCount(0)
    setFileName('')
    setSummary(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFile = (file: File) => {
    setFileName(file.name)
    setSummary(null)
    file.text().then((text) => {
      const parsed = Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => h.trim(),
      })
      if (parsed.errors.length) {
        toast.error('No se pudo leer el archivo — revisa que sea un CSV válido')
        return
      }
      const mapped: ParsedRow[] = []
      let invalid = 0
      for (const raw of parsed.data) {
        const row = mapTrackingCsvRow(raw)
        if (row) mapped.push(row)
        else invalid += 1
      }
      setRows(mapped)
      setInvalidCount(invalid)
    })
  }

  const handleImport = async () => {
    setImporting(true)
    try {
      const res = await fetch('/api/admin/orders/bulk-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const json = (await res.json()) as { data?: ImportSummary; error?: string }
      if (!res.ok || !json.data) {
        toast.error(json.error ?? 'Error al importar')
        return
      }
      setSummary(json.data)
      if (json.data.updated > 0) {
        toast.success(`${json.data.updated} pedido${json.data.updated !== 1 ? 's' : ''} actualizado${json.data.updated !== 1 ? 's' : ''}`)
        onImported()
      }
    } catch {
      toast.error('Error de conexión')
    } finally {
      setImporting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary-cyan" /> Importar guías de envío
          </DialogTitle>
        </DialogHeader>

        {!summary ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Sube un CSV con las columnas <strong>folio</strong>, <strong>transportadora</strong> y{' '}
              <strong>numero_guia</strong> (opcionalmente <strong>url_tracking</strong>). Cada pedido pasa a
              &quot;Enviado&quot; y se le notifica por correo automáticamente.
            </p>

            <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 p-8 cursor-pointer hover:border-primary-cyan/50 transition-colors">
              <FileSpreadsheet className="w-8 h-8 text-gray-300" />
              <span className="text-sm text-gray-500">
                {fileName || 'Selecciona un archivo .csv'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
              />
            </label>

            {fileName && (
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 text-sm space-y-1">
                <p className="text-gray-700">
                  <strong>{rows.length}</strong> fila{rows.length !== 1 ? 's' : ''} lista{rows.length !== 1 ? 's' : ''} para importar
                </p>
                {invalidCount > 0 && (
                  <p className="text-amber-600 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" /> {invalidCount} fila{invalidCount !== 1 ? 's' : ''} ignorada{invalidCount !== 1 ? 's' : ''} por faltar folio, transportadora o guía
                  </p>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleClose}>Cancelar</Button>
              <Button onClick={handleImport} disabled={rows.length === 0 || importing}>
                {importing ? 'Importando…' : `Importar ${rows.length || ''}`.trim()}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-800">
                {summary.updated} de {summary.total} pedidos actualizados · {summary.emailsSent} correo{summary.emailsSent !== 1 ? 's' : ''} de envío enviado{summary.emailsSent !== 1 ? 's' : ''}
              </p>
            </div>

            {summary.notFound.length > 0 && (
              <div className="text-sm">
                <p className="font-semibold text-gray-700 mb-1">No encontrados ({summary.notFound.length})</p>
                <p className="text-gray-500 font-mono text-xs break-words">{summary.notFound.join(', ')}</p>
              </div>
            )}

            {summary.notShippable.length > 0 && (
              <div className="text-sm">
                <p className="font-semibold text-gray-700 mb-1">No se pudieron marcar como enviados ({summary.notShippable.length})</p>
                <ul className="text-gray-500 text-xs space-y-0.5">
                  {summary.notShippable.map((r) => (
                    <li key={r.folio}><span className="font-mono">{r.folio}</span> — {r.detail}</li>
                  ))}
                </ul>
              </div>
            )}

            {summary.errors.length > 0 && (
              <div className="text-sm">
                <p className="font-semibold text-red-600 mb-1">Errores ({summary.errors.length})</p>
                <ul className="text-gray-500 text-xs space-y-0.5">
                  {summary.errors.map((r) => (
                    <li key={r.folio}><span className="font-mono">{r.folio}</span> — {r.detail}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>Importar otro archivo</Button>
              <Button onClick={handleClose}>Cerrar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
