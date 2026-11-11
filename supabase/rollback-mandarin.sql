-- ============================================
-- ROLLBACK del curso de mandarin (motor de lecciones)
-- NO esta en supabase/migrations a proposito, para que `db push` no lo aplique.
-- Segun docs/supabase-migrations.md el esquema solo se cambia con el CLI:
-- cuando se quiera eliminar el curso, crear una migracion nueva
--   npx supabase migration new remove_mandarin_course
-- pegar el contenido de este archivo en ella y aplicarla con
--   npx supabase db push --linked
--
-- Pasos para quitar el curso por completo:
--   1. git revert <commit "feat: publicar curso de mandarin ...">  y push
--   2. Aplicar este SQL como migracion (borra TODO el contenido y el
--      progreso de alumnos de las tablas mandarin_*; no se puede deshacer)
--   3. Si subiste audios propios, vaciar y borrar el bucket "mandarin-audio"
--      desde Storage en el dashboard (Supabase no permite borrarlo por SQL).
--   4. Opcional: borrar de supabase_migrations.schema_migrations las filas
--      de las versiones 20260907211455 .. 20260910143411 (nombres *_mandarin_*).
-- Las policies e indices se eliminan junto con sus tablas.
-- ============================================

begin;

drop function if exists public.mandarin_get_exercise_data(uuid);
drop function if exists public.mandarin_get_exercises_data(uuid[]);

drop table if exists public.mandarin_user_exercise_attempts cascade;
drop table if exists public.mandarin_user_progress cascade;
drop table if exists public.mandarin_exercises cascade;
drop table if exists public.mandarin_examples cascade;
drop table if exists public.mandarin_grammar_points cascade;
drop table if exists public.mandarin_lesson_vocab cascade;
drop table if exists public.mandarin_vocab_items cascade;
drop table if exists public.mandarin_lessons cascade;
drop table if exists public.mandarin_units cascade;
drop table if exists public.mandarin_levels cascade;
drop table if exists public.mandarin_courses cascade;

drop policy if exists "Mandarin audio: public read" on storage.objects;

commit;
