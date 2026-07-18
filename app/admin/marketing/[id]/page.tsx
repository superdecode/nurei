'use client'

import { use, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { TemplateGallery } from '@/components/admin/marketing/TemplateGallery'
import { CampaignFieldsPanel } from '@/components/admin/marketing/CampaignFieldsPanel'
import { CampaignPreview } from '@/components/admin/marketing/CampaignPreview'
import { AudienceBar } from '@/components/admin/marketing/AudienceBar'
import { getTemplate } from '@/lib/marketing/templates'
import type { CampaignContent, CampaignTemplateKey, MarketingCampaign } from '@/types'

const EMPTY_CONTENT: CampaignContent = {
  heading: '', body: '', imageUrl: null, ctaLabel: '', ctaLink: null, couponCode: null,
}

export default function CampaignEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const isNew = id === 'nueva'
  const router = useRouter()

  const [loading, setLoading] = useState(!isNew)
  const [campaignId, setCampaignId] = useState<string | null>(isNew ? null : id)
  const [templateKey, setTemplateKey] = useState<CampaignTemplateKey | null>(null)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [preheader, setPreheader] = useState('')
  const [content, setContent] = useState<CampaignContent>(EMPTY_CONTENT)
  const [segments, setSegments] = useState<string[]>([])
  const [tags] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (isNew) return
    fetch(`/api/admin/marketing/campaigns/${id}`)
      .then((r) => r.json())
      .then((json) => {
        const campaign = json.data as MarketingCampaign
        setCampaignId(campaign.id)
        setTemplateKey(campaign.template_key)
        setName(campaign.name)
        setSubject(campaign.subject)
        setPreheader(campaign.preheader ?? '')
        setContent(campaign.content)
        setSegments(campaign.audience_segments)
      })
      .catch(() => toast.error('No se pudo cargar la campaña'))
      .finally(() => setLoading(false))
  }, [id, isNew])

  const selectTemplate = (key: CampaignTemplateKey) => {
    const tpl = getTemplate(key)
    setTemplateKey(key)
    setName(tpl.name)
    setSubject(tpl.subject)
    setPreheader(tpl.preheader)
    setContent(tpl.content)
  }

  const persist = async (): Promise<string | null> => {
    const payload = {
      name, subject, preheader, content, template_key: templateKey,
      audience_segments: segments, audience_tags: tags,
      coupon_code: content.couponCode,
    }

    if (campaignId) {
      const res = await fetch(`/api/admin/marketing/campaigns/${campaignId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Error al guardar'); return null }
      return campaignId
    }

    const res = await fetch('/api/admin/marketing/campaigns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Error al crear campaña'); return null }
    setCampaignId(json.data.id)
    return json.data.id
  }

  const handleSaveDraft = async () => {
    setSaving(true)
    const savedId = await persist()
    setSaving(false)
    if (savedId) {
      toast.success('Borrador guardado')
      if (isNew) router.replace(`/admin/marketing/${savedId}`)
    }
  }

  const handleSend = async () => {
    setSending(true)
    const savedId = await persist()
    if (!savedId) { setSending(false); return }

    const res = await fetch(`/api/admin/marketing/campaigns/${savedId}/send`, { method: 'POST' })
    const json = await res.json()
    setSending(false)
    if (!res.ok) { toast.error(json.error ?? 'Error al enviar'); return }
    toast.success(`Campaña enviada — ${json.data.sent} entregados, ${json.data.failed} fallidos`)
    router.push('/admin/marketing')
  }

  if (loading) return <div className="p-6 text-sm text-gray-400">Cargando…</div>

  if (!templateKey) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-gray-900">Elige una plantilla</h1>
        <TemplateGallery onSelect={selectTemplate} />
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-20">
      <h1 className="text-xl font-bold text-gray-900">{isNew && !campaignId ? 'Nueva campaña' : name || 'Editar campaña'}</h1>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <CampaignPreview content={content} />
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-4">
          <CampaignFieldsPanel
            name={name}
            subject={subject}
            preheader={preheader}
            content={content}
            templateKey={templateKey}
            onNameChange={setName}
            onSubjectChange={setSubject}
            onPreheaderChange={setPreheader}
            onContentChange={setContent}
          />
        </div>
      </div>
      <AudienceBar
        segments={segments}
        tags={tags}
        onSegmentsChange={setSegments}
        onSaveDraft={handleSaveDraft}
        onSend={handleSend}
        saving={saving}
        sending={sending}
      />
    </div>
  )
}
