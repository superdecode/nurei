import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { resolveInternalUserDisplayName } from '@/lib/server/user-display-name'

type NotificationPrefs = {
  sound_enabled: boolean
  browser_notifications: boolean
  email_on_new_order: boolean
}

const DEFAULT_PREFS: NotificationPrefs = {
  sound_enabled: true,
  browser_notifications: true,
  email_on_new_order: true,
}

function normalizePrefs(raw: unknown): NotificationPrefs {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    sound_enabled: obj.sound_enabled !== false,
    browser_notifications: obj.browser_notifications !== false,
    email_on_new_order: obj.email_on_new_order !== false,
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const service = createServiceClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const userId = user.id

    const { data: profile, error } = await service
      .from('user_profiles')
      .select('id, full_name, role, admin_role_id, notification_prefs')
      .eq('id', userId)
      .maybeSingle()

    if (error || !profile) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    let perms: Record<string, string> = {}
    if (profile.admin_role_id) {
      const { data: adminRole } = await service
        .from('admin_roles')
        .select('permissions')
        .eq('id', profile.admin_role_id)
        .maybeSingle()
      perms = (adminRole?.permissions as Record<string, string> | undefined) ?? {}
    }
    const pedidosLevel = perms.pedidos
    const hasPedidosModule = pedidosLevel ? pedidosLevel !== 'sin_acceso' : true

    const meta = (user.user_metadata ?? {}) as Record<string, unknown>
    const fullNameFromAuthMeta =
      typeof meta.full_name === 'string' && meta.full_name.trim()
        ? meta.full_name.trim()
        : typeof meta.name === 'string' && meta.name.trim()
          ? meta.name.trim()
          : null

    const { data: customer } = await supabase
      .from('customers')
      .select('full_name, first_name, last_name')
      .eq('user_id', userId)
      .maybeSingle()

    const resolvedName = resolveInternalUserDisplayName({
      profileFullName: profile.full_name,
      authMetaFullName: fullNameFromAuthMeta,
      authMetaName: typeof meta.name === 'string' ? meta.name : null,
      email: user.email ?? null,
      customer,
    })
    const primaryFullName =
      typeof profile.full_name === 'string' && profile.full_name.trim()
        ? profile.full_name.trim()
        : null
    const responseName = primaryFullName ?? resolvedName ?? null

    return NextResponse.json({
      data: {
        id: profile.id,
        full_name: responseName,
        email: user.email ?? null,
        has_pedidos_module: hasPedidosModule,
        notification_prefs: normalizePrefs(profile.notification_prefs),
      },
    })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient()
    const service = createServiceClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    const userId = user.id

    const { data: profile, error } = await service
      .from('user_profiles')
      .select('id, admin_role:admin_roles(permissions), notification_prefs')
      .eq('id', userId)
      .single()

    if (error || !profile) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 })
    }

    const body = (await request.json()) as { notification_prefs?: Partial<NotificationPrefs> }
    const current = normalizePrefs(profile.notification_prefs)
    const merged = {
      ...current,
      ...(body.notification_prefs ?? {}),
    }

    const perms = (profile.admin_role as { permissions?: Record<string, string> } | null)?.permissions ?? {}
    const pedidosLevel = perms.pedidos
    if (pedidosLevel === 'sin_acceso') {
      merged.email_on_new_order = false
    }

    const { error: updateError } = await service
      .from('user_profiles')
      .update({ notification_prefs: merged })
      .eq('id', userId)

    if (updateError) {
      return NextResponse.json({ error: 'No se pudo guardar la configuración' }, { status: 500 })
    }

    return NextResponse.json({ data: { notification_prefs: merged } })
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
