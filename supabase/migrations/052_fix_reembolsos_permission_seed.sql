-- ============================================
-- 052: FIX 'reembolsos' PERMISSION SEED
-- ============================================
-- 050_refund_system.sql (applied as 051 after a filename collision) seeded the
-- new 'reembolsos' permission by matching admin_roles.name against the
-- original migration-004 seed values ('super_admin', 'admin', 'operador',
-- 'consulta'). On this project those roles were since renamed via the admin
-- UI (app/admin/usuarios) to 'Super Admin', 'Admin', 'Operador', 'Consulta',
-- so every UPDATE in 051 matched zero rows — no role has a 'reembolsos' key
-- at all, which the app's permission check (lib/server/require-admin-permission.ts)
-- treats as 'sin_acceso' by default. This normalizes the match so it works
-- regardless of the exact casing/spacing an admin has renamed roles to.

update public.admin_roles
set permissions = permissions || '{"reembolsos": "total"}'::jsonb
where lower(replace(name, ' ', '_')) = 'super_admin'
  and not (permissions ? 'reembolsos');

update public.admin_roles
set permissions = permissions || '{"reembolsos": "sin_acceso"}'::jsonb
where lower(replace(name, ' ', '_')) in ('admin', 'operador', 'consulta')
  and not (permissions ? 'reembolsos');
