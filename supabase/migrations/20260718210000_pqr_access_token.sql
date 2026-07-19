-- ============================================
-- FIX: guest PQR lookup relied on a guessable sequential ticket_number +
-- an email-match, guarded only by IP rate limiting. Add an unguessable
-- per-ticket token (mirrors orders.public_access_token) so guest lookup
-- doesn't depend on an attacker not knowing/guessing the filer's email.
-- ============================================
alter table public.pqr_tickets
  add column if not exists access_token uuid not null default gen_random_uuid();

create unique index if not exists idx_pqr_access_token on public.pqr_tickets(access_token);
