import { NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import type { AdminModule, PermissionLevel } from '@/types'

const PERMISSION_RANK: Record<PermissionLevel, number> = {
  sin_acceso: 0,
  lectura: 1,
  escritura: 2,
  total: 3,
}

export function hasSufficientPermission(
  level: PermissionLevel | undefined,
  minLevel: PermissionLevel
): boolean {
  return PERMISSION_RANK[level ?? 'sin_acceso'] >= PERMISSION_RANK[minLevel]
}

export async function requireAdminPermission(module: AdminModule, minLevel: PermissionLevel) {
  const supabase = await createServerSupabaseClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    return { error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }) }
  }

  const service = createServiceClient()
  const { data: profile } = await service
    .from('user_profiles')
    .select('role, admin_role:admin_roles(permissions)')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Sin permisos' }, { status: 403 }) }
  }

  const permissions =
    (profile.admin_role as { permissions?: Record<string, PermissionLevel> } | null)?.permissions ?? {}
  const level = permissions[module]

  if (!hasSufficientPermission(level, minLevel)) {
    return { error: NextResponse.json({ error: 'No tienes permiso para esta acción' }, { status: 403 }) }
  }

  return { userId: user.id }
}
