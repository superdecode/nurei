import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { createServerClient } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options?: Parameters<NextResponse['cookies']['set']>[2] }

function applyAuthCookies(res: NextResponse, pending: CookieToSet[]) {
  for (const { name, value, options } of pending) {
    if (value === '') {
      res.cookies.delete(name)
    } else {
      res.cookies.set(name, value, options)
    }
  }
  return res
}

export async function POST(request: NextRequest) {
  const pendingCookies: CookieToSet[] = []

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email y contraseña son requeridos' }, { status: 400 })
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet)
          },
        },
      },
    )

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const serviceClient = createServiceClient()
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('role, full_name')
      .eq('id', authData.user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      await supabase.auth.signOut()
      const res = NextResponse.json(
        { error: 'No tienes permisos de administrador' },
        { status: 403 },
      )
      return applyAuthCookies(res, pendingCookies)
    }

    const res = NextResponse.json({
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          full_name: profile.full_name ?? null,
          role: 'admin',
        },
        session: authData.session,
      },
    })
    return applyAuthCookies(res, pendingCookies)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error de autenticación'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
