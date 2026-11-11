-- ============================================
-- MANDARIN: course restructure — clearer level names, room for
-- pinyin/tone lessons, and a new tier for more advanced grammar.
-- No slugs change (lesson slugs are the only ones used in URLs),
-- only titles, order_index, and one new level+unit.
-- ============================================

update public.mandarin_levels set title = 'Introducción al chino' where slug = 'hsk-1';
update public.mandarin_levels set title = 'Gramática — Básico' where slug = 'gramatica-basica';

-- Make room for 2 new intro lessons (pinyin, tonos) ahead of hola/presentarse/pronombres
update public.mandarin_lessons set order_index = 3 where slug = 'hola';
update public.mandarin_lessons set order_index = 4 where slug = 'presentarse';
update public.mandarin_lessons set order_index = 5 where slug = 'pronombres';

insert into public.mandarin_levels (course_id, slug, title, order_index, is_published)
select id, 'gramatica-basico-avanzado', 'Gramática — Básico avanzado', 3, true
from public.mandarin_courses where slug = 'curso-de-mandarin'
on conflict (course_id, slug) do nothing;

insert into public.mandarin_units (level_id, slug, title, order_index, is_published)
select l.id, 'temas-avanzados', 'Temas avanzados', 1, true
from public.mandarin_levels l
join public.mandarin_courses c on c.id = l.course_id
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basico-avanzado'
on conflict (level_id, slug) do nothing;
