-- ============================================
-- MANDARIN: the pinyin lesson jumped straight from a partial intro
-- into aspiration and u/ü without ever giving a clear, complete
-- overview of the 21 initials and 6 simple finals. Adds that overview
-- as a new first section, shifting the existing 4 sections down by
-- one order_index each.
-- ============================================

update public.mandarin_grammar_points
set order_index = 2
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and title = 'El pinyin no se lee como el español';

update public.mandarin_grammar_points
set order_index = 3
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and title = 'Consonantes con y sin aspiración: b/p, d/t, g/k, j/q, z/c';

update public.mandarin_grammar_points
set order_index = 4
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and title = 'Cuándo "u" en realidad suena como ü';

update public.mandarin_grammar_points
set order_index = 5
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and title = 'La estructura de una sílaba en pinyin';

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Todas las consonantes y vocales del pinyin', 'El mandarín tiene 21 consonantes iniciales y 6 vocales simples (llamadas "finales" cuando van al final de una sílaba). Muchas se pronuncian igual o muy parecido al español: b, d, g, m, f, n, l, s y las vocales a, o, u no deberían darte problema. Las que sí requieren atención especial son las que ya viste o verás en esta lección: la aspiración en p, t, k, j, q y c (una ráfaga de aire que el español no distingue), los sonidos retroflejos zh, ch, sh y r (sin equivalente real en español), la x que suena como una "sh" suave, la vocal e (un sonido gutural que tampoco existe en español), y la ü de labios redondeados. Las semivocales y y w funcionan como en inglés, deslizándose hacia la vocal siguiente. Toda sílaba china combina una inicial (opcional) con una final: 好 (hǎo) es la inicial h más la final ao. Las finales simples también se combinan entre sí para formar finales compuestas (ai, an, ang, ian, uan...), pero siempre a partir de estas 6 vocales base — dominar estas 21 consonantes y 6 vocales es, en la práctica, dominar el 100% de los sonidos del mandarín.', 1
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;
