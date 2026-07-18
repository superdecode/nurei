'use client'

import { useEffect, useState } from 'react'
import { CtaLinkPicker } from '@/components/admin/marketing/CtaLinkPicker'
import type { CampaignContent, CampaignTemplateKey } from '@/types'

interface CouponOption {
  code: string
  discount_type: string
  value: number
}

interface CampaignFieldsPanelProps {
  name: string
  subject: string
  preheader: string
  content: CampaignContent
  templateKey: CampaignTemplateKey
  onNameChange: (name: string) => void
  onSubjectChange: (subject: string) => void
  onPreheaderChange: (preheader: string) => void
  onContentChange: (content: CampaignContent) => void
}

export function CampaignFieldsPanel({
  name, subject, preheader, content, templateKey,
  onNameChange, onSubjectChange, onPreheaderChange, onContentChange,
}: CampaignFieldsPanelProps) {
  const [coupons, setCoupons] = useState<CouponOption[]>([])
  const [mediaOpen, setMediaOpen] = useState(false)
  const [media, setMedia] = useState<Array<{ id: string; url: string }>>([])

  useEffect(() => {
    if (templateKey !== 'promo') return
    fetch('/api/admin/marketing/coupons')
      .then((r) => r.json())
      .then((json) => setCoupons(json.data ?? []))
      .catch(() => setCoupons([]))
  }, [templateKey])

  useEffect(() => {
    if (!mediaOpen) return
    fetch('/api/admin/media')
      .then((r) => r.json())
      .then((json) => setMedia(json.data ?? []))
      .catch(() => setMedia([]))
  }, [mediaOpen])

  const update = (patch: Partial<CampaignContent>) => onContentChange({ ...content, ...patch })

  return (
    <div className="space-y-4 text-sm">
      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre (interno)</label>
        <input value={name} onChange={(e) => onNameChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Asunto</label>
        <input value={subject} onChange={(e) => onSubjectChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Preheader <span className="font-normal text-gray-400">(texto de vista previa en el inbox)</span></label>
        <input value={preheader} onChange={(e) => onPreheaderChange(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Título</label>
        <input value={content.heading} onChange={(e) => update({ heading: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Texto</label>
        <textarea value={content.body} onChange={(e) => update({ body: e.target.value })} rows={4} className="w-full px-3 py-2 rounded-lg border border-gray-200" />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Imagen</label>
        {content.imageUrl ? (
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={content.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
            <button type="button" onClick={() => update({ imageUrl: null })} className="text-xs text-red-600 hover:underline">Quitar</button>
          </div>
        ) : (
          <button type="button" onClick={() => setMediaOpen(true)} className="h-9 px-3 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium">
            Elegir de galería
          </button>
        )}
        {mediaOpen && (
          <div className="mt-2 max-h-40 overflow-y-auto rounded-lg border border-gray-100 grid grid-cols-4 gap-1 p-1">
            {media.map((m) => (
              <button key={m.id} type="button" onClick={() => { update({ imageUrl: m.url }); setMediaOpen(false) }} className="aspect-square rounded overflow-hidden border border-gray-200 hover:border-primary-cyan">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500 mb-1">Botón CTA</label>
        <input
          value={content.ctaLabel}
          onChange={(e) => update({ ctaLabel: e.target.value })}
          placeholder="Texto del botón"
          className="w-full h-9 px-3 rounded-lg border border-gray-200 mb-2"
        />
        <CtaLinkPicker value={content.ctaLink} onChange={(ctaLink) => update({ ctaLink })} />
      </div>

      {templateKey === 'promo' && (
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Cupón</label>
          <select
            value={content.couponCode ?? ''}
            onChange={(e) => update({ couponCode: e.target.value || null })}
            className="w-full h-9 px-3 rounded-lg border border-gray-200"
          >
            <option value="">Sin cupón</option>
            {coupons.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.discount_type === 'percentage' ? `${c.value}%` : `$${(c.value / 100).toFixed(2)}`}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
