import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    // Sign in with Supabase Auth
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* Server Component context */ }
          },
        },
      }
    )

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    // Verify admin role
    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('role')
      .eq('id', authData.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      // Sign out non-admin users
      await supabase.auth.signOut()
      return NextResponse.json({ error: 'No tienes permisos de administrador' }, { status: 403 })
    }

    return NextResponse.json({
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: 'admin',
        },
        session: authData.session,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error de autenticación'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
