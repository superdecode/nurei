import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    await supabase.auth.signOut()
    return NextResponse.json({ data: { success: true } })
  } catch {
    return NextResponse.json({ error: 'Error al cerrar sesión' }, { status: 500 })
  }
}
