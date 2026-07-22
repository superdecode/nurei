import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getLoyaltyStatus, getLedgerHistory } from '@/lib/supabase/queries/loyalty'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const [status, history] = await Promise.all([
      getLoyaltyStatus(supabase, user.id),
      getLedgerHistory(supabase, user.id),
    ])

    return NextResponse.json({ data: { ...status, history } })
  } catch {
    return NextResponse.json({ error: 'Error al obtener el estado de lealtad' }, { status: 500 })
  }
}
