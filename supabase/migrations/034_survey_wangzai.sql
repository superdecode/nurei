-- Survey responses for Wangzai QQ gummies tasting event
create table if not exists survey_responses (
  id uuid primary key default gen_random_uuid(),

  -- Section I
  age_range text not null check (age_range in ('menos_18', '18_22', '23_25', '26_mas')),
  snack_frequency text not null check (snack_frequency in ('diario', '3_5_semana', '1_2_semana', 'ocasional')),
  buy_places text[] not null default '{}',
  buy_places_other text,

  -- Section II
  asian_snacks_before text not null check (asian_snacks_before in ('frecuentemente', 'algunos', 'nunca')),
  texture_rating text not null check (texture_rating in ('encanta', 'bien', 'normal', 'no_gusto')),
  texture_dislike_reason text,
  sweetness_rating text not null check (sweetness_rating in ('muy_dulce', 'poco_dulce', 'perfecto', 'falta_dulzor')),
  fruity_taste_rating text not null check (fruity_taste_rating in ('encanto', 'bien_otros_sabores', 'neutral', 'no_gusto')),
  would_share text not null check (would_share in ('si', 'tal_vez', 'no')),
  price_acceptable text not null check (price_acceptable in ('si', 'poco_caro', 'muy_caro', 'no_importa')),
  max_price_mxn integer,

  submitted_at timestamptz not null default now(),
  ip_address inet
);

-- Admin reads; public inserts only
alter table survey_responses enable row level security;

create policy "public_insert_survey" on survey_responses
  for insert to anon with check (true);

create policy "admin_select_survey" on survey_responses
  for select using (
    exists (
      select 1 from admin_roles ar
      where ar.user_id = auth.uid()
    )
  );
