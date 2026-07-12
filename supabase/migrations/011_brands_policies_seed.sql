-- Brands: políticas para admins autenticados + datos iniciales (además del rol de servicio en API).

-- Legacy consolidation: this function used to live in a second 011 file.
-- Keep it here so there is only one active migration file per version.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

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
