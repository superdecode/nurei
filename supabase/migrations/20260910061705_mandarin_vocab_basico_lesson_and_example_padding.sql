-- ============================================
-- MANDARIN: two fixes.
--
-- 1. New lesson at the end of "Introducción al chino" (after
-- 'pronombres', order_index 6 — position-based numbering means this
-- needs no renumbering of anything else): a pure vocabulary bank of
-- 15 high-frequency basic words, mixing words already seen in later
-- lessons (reinforcement — the global vocab bank means linking them
-- here doesn't duplicate anything) with new ones. Closes with a note
-- recommending spaced-repetition practice and naming concrete apps,
-- since this course alone won't build full vocabulary retention.
--
-- 2. The three lessons with only 2 examples (sustantivos,
-- demostrativos, sufijo-er) get a third, following this course's
-- established "one extra simple example per lesson" pattern.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, 'vocabulario-basico-util', 'Vocabulario básico útil', 'Ampliar tu banco de palabras esenciales antes de seguir con la gramática.', 6, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
where c.slug = 'curso-de-mandarin' and l.slug = 'hsk-1' and u.slug = 'unidad-1-introduccion'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('水', 'shuǐ', 'agua'),
  ('茶', 'chá', 'té'),
  ('米饭', 'mǐfàn', 'arroz (cocido)'),
  ('钱', 'qián', 'dinero'),
  ('时间', 'shíjiān', 'tiempo'),
  ('今天', 'jīntiān', 'hoy'),
  ('现在', 'xiànzài', 'ahora'),
  ('车', 'chē', 'coche/vehículo')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values
  ('水', 1), ('茶', 2), ('米饭', 3), ('钱', 4), ('时间', 5), ('今天', 6), ('现在', 7),
  ('朋友', 8), ('老师', 9), ('学生', 10), ('家', 11), ('猫', 12), ('狗', 13), ('书', 14), ('车', 15)
) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'vocabulario-basico-util'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Tu banco de vocabulario básico', 'Antes de seguir con la gramática, aquí tienes un banco con algunas de las palabras más útiles del día a día. Varias ya las viste en lecciones anteriores — 朋友 (péngyou, "amigo/a"), 老师 (lǎoshī, "profesor/a"), 学生 (xuéshēng, "estudiante"), 家 (jiā, "casa/familia"), 猫 (māo, "gato"), 狗 (gǒu, "perro"), 书 (shū, "libro") — y volverás a verlas muchas veces más a lo largo del curso; otras son nuevas y aparecerán pronto: 水 (shuǐ, "agua"), 茶 (chá, "té"), 米饭 (mǐfàn, "arroz"), 钱 (qián, "dinero"), 时间 (shíjiān, "tiempo"), 今天 (jīntiān, "hoy"), 现在 (xiànzài, "ahora") y 车 (chē, "coche"). Cuantas más palabras básicas reconozcas de memoria, más fácil te resultará entender los ejemplos y ejercicios del resto del curso. [[AVANZADO]]La mejor forma de ampliar tu vocabulario más allá de lo que cubre este curso es practicar todos los días con algo que te obligue a recordar activamente, no solo a reconocer pasivamente: escribir los caracteres a mano, o usar una aplicación de repetición espaciada. Algunas opciones populares: HelloChinese y Duolingo (cursos completos, gratuitos con compras opcionales dentro de la app), Chinese Flashcards & Pinyin (gratuita, enfocada solo en vocabulario), Laoshi (de pago, también enfocada en vocabulario), o Anki (gratuita y personalizable, muy usada para memorizar cualquier tipo de vocabulario con tarjetas que tú mismo creas).[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'vocabulario-basico-util'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 水?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '水'),
    'options', jsonb_build_array('agua', 'té', 'dinero'), 'correct_option', 'agua'),
  1, true
from public.mandarin_lessons where slug = 'vocabulario-basico-util'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 现在?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '现在'),
    'options', jsonb_build_array('ahora', 'hoy', 'tiempo'), 'correct_option', 'ahora'),
  2, true
from public.mandarin_lessons where slug = 'vocabulario-basico-util'
on conflict do nothing;

-- example padding for the 3 sparsest lessons
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有猫，你有狗。', 'Wǒ yǒu māo, nǐ yǒu gǒu.', 'Yo tengo gato, tú tienes perro.', 3
from public.mandarin_lessons where slug = 'sustantivos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这个是猫，那个是狗。', 'Zhège shì māo, nàge shì gǒu.', 'Este es un gato, ese es un perro.', 3
from public.mandarin_lessons where slug = 'demostrativos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我朋友想去那儿。', 'Wǒ péngyou xiǎng qù nàr.', 'Mi amigo quiere ir allí.', 3
from public.mandarin_lessons where slug = 'sufijo-er'
on conflict do nothing;
