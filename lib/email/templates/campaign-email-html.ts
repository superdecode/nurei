import { escapeHtml } from '@/lib/email/escape-html'
import { BRAND_BG, BRAND_AMBER, TEXT_DARK, TEXT_MUTED, CARD_BORDER } from '@/lib/email/templates/order-emails-html'
import type { CampaignContent } from '@/types'

export interface CampaignEmailProps {
  content: CampaignContent
  /** The CTA link already resolved to an absolute URL (product/category slugs resolved upstream). */
  resolvedCtaUrl: string
  /** Absolute URL for the 1x1 open-tracking pixel; omitted (no img) when not provided, e.g. in previews. */
  trackingPixelUrl?: string
  /** Inbox preview text — rendered visually hidden right after <body>. Omitted when not provided. */
  preheader?: string
}

export function renderCampaignEmailHtml(p: CampaignEmailProps): string {
  const bodyParagraphs = p.content.body
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map(
      (line) =>
        `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${TEXT_DARK};">${escapeHtml(line)}</p>`
    )
    .join('')

  const imageBlock = p.content.imageUrl
    ? `<img src="${escapeHtml(p.content.imageUrl)}" alt="" style="width:100%;max-width:480px;border-radius:12px;display:block;margin:0 auto 16px;" />`
    : ''

  const couponBlock = p.content.couponCode
    ? `<div style="margin:16px 0;padding:12px 16px;border:2px dashed ${BRAND_AMBER};border-radius:10px;text-align:center;font-weight:bold;font-size:16px;color:${TEXT_DARK};letter-spacing:1px;">${escapeHtml(p.content.couponCode)}</div>`
    : ''

  const trackingPixel = p.trackingPixelUrl
    ? `<img src="${escapeHtml(p.trackingPixelUrl)}" width="1" height="1" alt="" style="display:none;" />`
    : ''

  const preheaderBlock = p.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(p.preheader)}</div>`
    : ''

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/><title>${escapeHtml(p.content.heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND_BG};font-family:Arial,Helvetica,sans-serif;">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_BG};padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:24px;border:1px solid ${CARD_BORDER};overflow:hidden;box-shadow:0 10px 40px rgba(17,24,39,0.08);">
          <tr>
            <td style="background:${BRAND_AMBER};padding:20px;text-align:center;">
              <span style="font-size:22px;font-weight:900;color:${TEXT_DARK};letter-spacing:-0.5px;">nurei</span>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 16px;font-size:22px;color:${TEXT_DARK};">${escapeHtml(p.content.heading)}</h1>
              ${imageBlock}
              ${bodyParagraphs}
              ${couponBlock}
              <div style="text-align:center;margin-top:24px;">
                <a href="${escapeHtml(p.resolvedCtaUrl)}" style="display:inline-block;background:${BRAND_AMBER};color:${TEXT_DARK};text-decoration:none;padding:13px 28px;border:2px solid ${TEXT_DARK};border-radius:12px;font-weight:800;font-size:14px;">${escapeHtml(p.content.ctaLabel)}</a>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;text-align:center;border-top:1px solid ${CARD_BORDER};">
              <p style="margin:0;font-size:11px;color:${TEXT_MUTED};">nurei.mx</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel}
</body>
</html>`
}
