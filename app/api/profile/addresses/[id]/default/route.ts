import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { setDefaultAddress } from '@/lib/supabase/queries/addresses'

export async function POST(
  _: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

    const address = await setDefaultAddress(supabase, id)
    return NextResponse.json({ data: address })
  } catch {
    return NextResponse.json({ error: 'Error al actualizar dirección predeterminada' }, { status: 500 })
  }
}
