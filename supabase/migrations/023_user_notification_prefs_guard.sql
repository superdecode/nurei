-- Guard migration for per-user admin notification preferences.

alter table public.user_profiles
  add column if not exists notification_prefs jsonb not null
  default '{"sound_enabled":true,"browser_notifications":true,"email_on_new_order":true}';
