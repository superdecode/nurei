'use client'

import { useMemo, useState } from 'react'
import { Check, Clipboard, ExternalLink, Mail, Monitor, Smartphone } from 'lucide-react'

export type EmailPreview = {
  id: string
  group: 'Pedidos' | 'Marketing'
  label: string
  subject: string
  description: string
  html: string
}

export function EmailPreviewStudio({ previews }: { previews: EmailPreview[] }) {
  const [group, setGroup] = useState<EmailPreview['group']>('Pedidos')
  const [selectedId, setSelectedId] = useState(previews[0]?.id ?? '')
  const [viewport, setViewport] = useState<'desktop' | 'mobile'>('desktop')
  const [copied, setCopied] = useState(false)

  const visiblePreviews = useMemo(
    () => previews.filter((preview) => preview.group === group),
    [group, previews],
  )
  const selected = previews.find((preview) => preview.id === selectedId) ?? visiblePreviews[0]

  const selectGroup = (nextGroup: EmailPreview['group']) => {
    setGroup(nextGroup)
    const first = previews.find((preview) => preview.group === nextGroup)
    if (first) setSelectedId(first.id)
  }

  const copyHtml = async () => {
    if (!selected) return
    await navigator.clipboard.writeText(selected.html)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  const openPreview = () => {
    if (!selected) return
    const url = URL.createObjectURL(new Blob([selected.html], { type: 'text/html' }))
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }

  if (!selected) return null

  return (
    <main className="min-h-screen bg-[#171717] text-white">
      <header className="border-b border-white/10 bg-[#171717]/95 px-5 py-5 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.22em] text-[#FFC107]">
              <Mail className="h-3.5 w-3.5" /> Nurei · herramienta local
            </div>
            <h1 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">Email Studio</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
              Revisa las plantillas reales con datos de ejemplo. Esta ruta solo existe durante el desarrollo local.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-white/10 bg-white/[0.04] p-1">
              <button
                type="button"
                onClick={() => setViewport('desktop')}
                className={`flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${viewport === 'desktop' ? 'bg-[#FFC107] text-[#171717]' : 'text-white/60 hover:text-white'}`}
              >
                <Monitor className="h-3.5 w-3.5" /> Escritorio
              </button>
              <button
                type="button"
                onClick={() => setViewport('mobile')}
                className={`flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold transition ${viewport === 'mobile' ? 'bg-[#FFC107] text-[#171717]' : 'text-white/60 hover:text-white'}`}
              >
                <Smartphone className="h-3.5 w-3.5" /> Móvil
              </button>
            </div>
            <button
              type="button"
              onClick={() => { void copyHtml() }}
              className="flex h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-xs font-bold text-white/75 transition hover:border-white/25 hover:text-white"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Clipboard className="h-4 w-4" />}
              {copied ? 'Copiado' : 'Copiar HTML'}
            </button>
            <button
              type="button"
              onClick={openPreview}
              className="flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-xs font-black text-[#171717] transition hover:bg-[#FFC107]"
            >
              <ExternalLink className="h-4 w-4" /> Abrir aislado
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1600px] gap-5 p-5 sm:p-8 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="self-start rounded-2xl border border-white/10 bg-white/[0.035] p-3 xl:sticky xl:top-6">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-black/20 p-1">
            {(['Pedidos', 'Marketing'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => selectGroup(item)}
                className={`rounded-lg px-3 py-2.5 text-xs font-black transition ${group === item ? 'bg-white text-[#171717]' : 'text-white/50 hover:text-white'}`}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-1">
            {visiblePreviews.map((preview, index) => (
              <button
                key={preview.id}
                type="button"
                onClick={() => setSelectedId(preview.id)}
                className={`group w-full rounded-xl border px-3.5 py-3 text-left transition ${selected.id === preview.id ? 'border-[#FFC107]/50 bg-[#FFC107]/10' : 'border-transparent hover:border-white/10 hover:bg-white/[0.04]'}`}
              >
                <span className={`mb-1 block font-mono text-[10px] font-bold ${selected.id === preview.id ? 'text-[#FFC107]' : 'text-white/25'}`}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="block text-sm font-bold text-white">{preview.label}</span>
                <span className="mt-1 block text-xs leading-5 text-white/40">{preview.description}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-[#222222]">
          <div className="border-b border-white/10 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/35">Asunto</p>
                <p className="mt-1 truncate text-sm font-bold text-white">{selected.subject}</p>
              </div>
              <span className="w-fit rounded-full border border-[#FFC107]/25 bg-[#FFC107]/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#FFC107]">
                {selected.group}
              </span>
            </div>
          </div>

          <div className="min-h-[860px] overflow-x-auto bg-[radial-gradient(circle_at_top,#3a3525_0,#292929_38%,#202020_100%)] p-4 sm:p-8">
            <div
              className={`mx-auto overflow-hidden rounded-[22px] bg-white shadow-[0_28px_90px_rgba(0,0,0,.45)] transition-all duration-300 ${viewport === 'mobile' ? 'w-[390px] max-w-full' : 'w-full max-w-[760px]'}`}
            >
              <iframe
                key={`${selected.id}-${viewport}`}
                title={`Vista previa: ${selected.label}`}
                srcDoc={selected.html}
                sandbox=""
                className="block h-[820px] w-full border-0 bg-white"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
