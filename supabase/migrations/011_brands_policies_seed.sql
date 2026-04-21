-- Brands: políticas para admins autenticados + datos iniciales (además del rol de servicio en API).

-- Permitir escritura a cuentas con perfil admin (fallback si la API no usa service role).
drop policy if exists "Brands: admin manage" on public.brands;
create policy "Brands: admin manage"
  on public.brands
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  )
  with check (
    exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid() and up.role = 'admin'
    )
  );

-- Seed idempotente (nombre único por lower(trim)).
insert into public.brands (name)
select v from (values
  ('Sin asignar'),
  ('Importación directa'),
  ('House brand')
) as t(v)
where not exists (
  select 1 from public.brands b where lower(trim(b.name)) = lower(trim(t.v))
);
