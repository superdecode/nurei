// components/admin/marketing/TemplateGallery.tsx
'use client'

import { Plus } from 'lucide-react'
import { CAMPAIGN_TEMPLATES } from '@/lib/marketing/templates'
import { CampaignPreview } from '@/components/admin/marketing/CampaignPreview'
import type { CampaignTemplateKey } from '@/types'

interface TemplateGalleryProps {
  onSelect: (key: CampaignTemplateKey) => void
}

export function TemplateGallery({ onSelect }: TemplateGalleryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {CAMPAIGN_TEMPLATES.filter((t) => t.templateKey !== 'blank').map((template) => (
        <button
          key={template.templateKey}
          type="button"
          onClick={() => onSelect(template.templateKey)}
          className="text-left rounded-2xl border border-gray-100 bg-white shadow-sm overflow-hidden hover:border-primary-cyan hover:shadow-md transition"
        >
          <div className="h-28 overflow-hidden">
            <CampaignPreview content={template.content} scale="mini" />
          </div>
          <div className="p-3">
            <p className="text-sm font-semibold text-gray-900">{template.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{template.description}</p>
          </div>
        </button>
      ))}

      <button
        type="button"
        onClick={() => onSelect('blank')}
        className="rounded-2xl border-2 border-dashed border-gray-200 bg-white flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-primary-cyan hover:text-primary-dark transition min-h-[160px]"
      >
        <Plus className="w-6 h-6" />
        <span className="text-sm font-medium">En blanco</span>
      </button>
    </div>
  )
}
