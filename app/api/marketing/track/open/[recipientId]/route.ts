import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

// 1x1 transparent GIF, base64-encoded.
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7', 'base64')

export async function GET(request: NextRequest, { params }: { params: Promise<{ recipientId: string }> }) {
  const { recipientId } = await params
  try {
    const supabase = createServiceClient()
    const { data: recipient } = await supabase
      .from('marketing_campaign_recipients')
      .select('open_count, opened_at')
      .eq('id', recipientId)
      .single()

    if (recipient) {
      await supabase
        .from('marketing_campaign_recipients')
        .update({
          open_count: (recipient.open_count ?? 0) + 1,
          opened_at: recipient.opened_at ?? new Date().toISOString(),
        })
        .eq('id', recipientId)
    }
  } catch {
    // Never fail the pixel response — tracking is best-effort.
  }

  return new NextResponse(PIXEL, {
    headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store' },
  })
}
