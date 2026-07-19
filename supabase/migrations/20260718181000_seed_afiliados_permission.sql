-- ============================================
-- FIX: seed missing 'afiliados' permission key
-- ============================================
-- 'afiliados' has been a valid AdminModule (types/index.ts) since the
-- affiliate admin UI shipped, but no migration ever backfilled it into
-- admin_roles.permissions the way 052_fix_reembolsos_permission_seed.sql did
-- for 'reembolsos'. lib/server/require-admin-permission.ts treats a missing
-- key as 'sin_acceso' by default, so the app/api/admin/affiliates/* routes
-- just switched to requireAdminPermission('afiliados', ...) in this same
-- change would otherwise lock out every existing admin role, including
-- super_admin, from the whole Affiliates section. Backfill mirrors the
-- 'pagos' distribution (closest existing module in sensitivity), matched by
-- normalized name the same way 052 does to survive UI renames.

update public.admin_roles
set permissions = permissions || '{"afiliados": "total"}'::jsonb
where lower(replace(name, ' ', '_')) = 'super_admin'
  and not (permissions ? 'afiliados');

update public.admin_roles
set permissions = permissions || '{"afiliados": "escritura"}'::jsonb
where lower(replace(name, ' ', '_')) = 'admin'
  and not (permissions ? 'afiliados');

update public.admin_roles
set permissions = permissions || '{"afiliados": "lectura"}'::jsonb
where lower(replace(name, ' ', '_')) in ('operador', 'consulta')
  and not (permissions ? 'afiliados');

-- Any custom role created via the admin UI that has neither a system name
-- match above nor an 'afiliados' key yet: default to 'sin_acceso' (safe
-- default) rather than leaving the key entirely absent.
update public.admin_roles
set permissions = permissions || '{"afiliados": "sin_acceso"}'::jsonb
where not (permissions ? 'afiliados');
