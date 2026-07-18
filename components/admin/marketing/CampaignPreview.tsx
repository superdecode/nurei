'use client'

import type { CampaignContent } from '@/types'

interface CampaignPreviewProps {
  content: CampaignContent
  scale?: 'full' | 'mini'
}

export function CampaignPreview({ content, scale = 'full' }: CampaignPreviewProps) {
  const isMini = scale === 'mini'

  return (
    <div
      className="bg-[#FFFBEB] rounded-2xl overflow-hidden"
      style={isMini ? { fontSize: '6px', padding: '8px' } : { padding: '24px' }}
    >
      <div
        className="bg-[#FFC107] rounded-lg flex items-center justify-center font-black text-[#111827]"
        style={{ height: isMini ? 20 : 48, fontSize: isMini ? 8 : 18 }}
      >
        nurei
      </div>

      <div className={isMini ? 'mt-2 space-y-1' : 'mt-5 space-y-3'}>
        <h3
          className="font-bold text-[#111827] break-words"
          style={{ fontSize: isMini ? 8 : 20 }}
        >
          {content.heading || 'Título de la campaña'}
        </h3>

        {content.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={content.imageUrl}
            alt=""
            className="w-full rounded-lg object-cover"
            style={{ height: isMini ? 24 : 180 }}
          />
        )}

        <p
          className="text-gray-700 whitespace-pre-line break-words"
          style={{ fontSize: isMini ? 6 : 14 }}
        >
          {content.body || 'El texto de tu campaña aparece aquí.'}
        </p>

        {content.couponCode && (
          <div
            className="border-2 border-dashed border-[#FFC107] rounded-lg text-center font-bold text-[#111827]"
            style={{ padding: isMini ? '2px' : '10px', fontSize: isMini ? 6 : 14 }}
          >
            {content.couponCode}
          </div>
        )}

        {content.ctaLabel && (
          <div className="flex justify-center" style={{ marginTop: isMini ? 4 : 16 }}>
            <div
              className="bg-[#111827] text-white rounded-full font-semibold"
              style={{ padding: isMini ? '2px 8px' : '10px 24px', fontSize: isMini ? 6 : 13 }}
            >
              {content.ctaLabel}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
