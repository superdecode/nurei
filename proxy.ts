import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAdminRoute = path.startsWith('/admin') || path.startsWith('/api/admin')
  const isAffiliateRoute = path.startsWith('/affiliate') || path.startsWith('/api/affiliate')

  // First-line auth gate — route handlers do full role verification.
  // Admin has no standalone login page: app/admin/layout.tsx renders an inline
  // login form for any unauthenticated /admin/* request, so only API routes
  // get a hard redirect/401 here — redirecting page routes would have nowhere
  // valid to land.
  if (isAdminRoute && !user && path.startsWith('/api/')) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  if (isAffiliateRoute && path !== '/affiliates/login' && !user) {
    if (path.startsWith('/api/')) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/affiliates/login'
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
