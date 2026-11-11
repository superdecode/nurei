-- ============================================
-- MANDARIN: 'pronombres' (Introducción al chino, lesson 5) and
-- 'pronombres-personales' (Gramática — Básico, lesson 6) taught
-- almost the same material twice: the 他/她 homophone fact and the
-- 们-plural rule were duplicated verbatim between the two. The ONLY
-- genuinely new content in 'pronombres-personales' was 您 (formal
-- "you") and 咱们 (inclusive "we"). Consolidated: that new content
-- moves into 'pronombres', and 'pronombres-personales' is deleted
-- entirely (its grammar/vocab-links/examples/exercises cascade with
-- it — the underlying vocab_items rows for 您/咱们/它/老师/吗 stay in
-- the shared vocab bank, only the lesson-specific links are removed).
-- Position numbering elsewhere is index-based (see
-- getLessonGlobalPosition), so removing one lesson needs no manual
-- reordering of the lessons that follow it.
-- ============================================

update public.mandarin_vocab_items
set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/2/24/LL-Q9192_%28cmn%29-Luilui6666-%E6%82%A8.wav'
where hanzi = '您';

update public.mandarin_vocab_items
set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/7/72/LL-Q9192_%28cmn%29-Jouketou-%E5%92%B1%E4%BB%AC.wav'
where hanzi = '咱们';

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '您 (formal) y 咱们 (nosotros inclusivo)', '您 (nín) es la forma formal y respetuosa de 你 (tú) — se usa con desconocidos, personas mayores o en contextos de respeto, igual que "usted" en español. Además de 我们 que ya viste, existe otra forma de decir "nosotros": 咱们 (zánmen). La diferencia es sutil pero real: 咱们 SIEMPRE incluye a la persona con la que hablas (como decir "nosotros, tú y yo juntos"), mientras que 我们 puede excluirla, dependiendo del contexto — por eso 咱们 se siente más cercano o inclusivo. También existe 它 (tā), un pronombre reservado exclusivamente para objetos y animales, nunca para personas.', 3
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '您好，您是老师吗？', 'Nín hǎo, nín shì lǎoshī ma?', 'Hola, ¿usted es profesor/a?', 3
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '咱们是学生，他们是老师。', 'Zánmen shì xuéshēng, tāmen shì lǎoshī.', 'Nosotros somos estudiantes, ellos son profesores.', 4
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 您?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '您'),
    'options', jsonb_build_array('usted (formal)', 'ustedes', 'nosotros'), 'correct_option', 'usted (formal)'),
  3, true
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('您', 6), ('咱们', 7), ('它', 8)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'pronombres'
on conflict do nothing;

delete from public.mandarin_lessons where slug = 'pronombres-personales';
