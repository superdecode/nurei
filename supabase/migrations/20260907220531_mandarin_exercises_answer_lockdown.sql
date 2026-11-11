-- ============================================
-- MANDARIN: lock down answer data + enforce global lesson slug uniqueness
-- ============================================
-- Fix 1: `mandarin_exercises: anyone can read published` (RLS) only restricts
-- rows, not columns. Once an exercise is published, anon/authenticated could
-- call the PostgREST REST API directly (e.g. GET /rest/v1/mandarin_exercises?
-- select=data) with the public anon key and read `data`, which carries
-- `correct_option`/`correct_order` — bypassing the app-layer stripping done
-- in stripCorrectAnswer (lib/supabase/queries/mandarin.ts). RLS is row-level
-- only, so we additionally revoke column-level SELECT on `data` and grant
-- select on every other column instead. Server-side grading still needs the
-- raw `data` for the authenticated user's own client, so we expose it only
-- through a security definer function that bypasses the column grant.

create or replace function public.mandarin_get_exercise_data(p_exercise_id uuid)
returns jsonb
language sql
security definer
set search_path = public, pg_temp
as $$
  select data from public.mandarin_exercises
  where id = p_exercise_id and is_published = true;
$$;

revoke all on function public.mandarin_get_exercise_data(uuid) from public;
grant execute on function public.mandarin_get_exercise_data(uuid) to anon, authenticated;

-- getLessonDetailBySlug also needs `data` (to render options/tokens, with
-- correct_option/correct_order stripped afterwards in stripCorrectAnswer) for
-- every exercise in a lesson at once. A batched variant avoids an N+1 RPC
-- call per exercise on the lesson page.
create or replace function public.mandarin_get_exercises_data(p_exercise_ids uuid[])
returns table (id uuid, data jsonb)
language sql
security definer
set search_path = public, pg_temp
as $$
  select e.id, e.data from public.mandarin_exercises e
  where e.id = any(p_exercise_ids) and e.is_published = true;
$$;

revoke all on function public.mandarin_get_exercises_data(uuid[]) from public;
grant execute on function public.mandarin_get_exercises_data(uuid[]) to anon, authenticated;

revoke select on public.mandarin_exercises from anon, authenticated;
grant select (id, lesson_id, type, prompt, order_index, is_published, created_at, updated_at)
  on public.mandarin_exercises to anon, authenticated;

-- Fix 3: getLessonDetailBySlug looks up lessons by `slug` alone, but the
-- schema only enforces `unique (unit_id, slug)`. Enforce global uniqueness
-- at the DB level so a future cross-unit slug collision can't make
-- `.maybeSingle()` error. Seeded slugs (hola, presentarse, pronombres from
-- the Task 7 seed migration) don't collide, so this applies cleanly.
alter table public.mandarin_lessons add constraint mandarin_lessons_slug_key unique (slug);
