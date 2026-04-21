-- Add first_name, last_name, phone to affiliate_profiles
alter table public.affiliate_profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists phone      text;
