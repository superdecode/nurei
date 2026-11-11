-- ============================================
-- MANDARIN: HSK1 demo content — DEMO ONLY, pending review by Elian
-- All rows here are is_demo_content = true (default) and marked
-- as such precisely so they are not mistaken for reviewed content.
-- ============================================

insert into public.mandarin_courses (slug, title, description, is_published) values
  ('curso-de-mandarin', 'Curso de Mandarín', 'Aprende mandarín desde cero, en español.', true)
on conflict (slug) do nothing;

insert into public.mandarin_levels (course_id, slug, title, order_index, is_published)
select id, 'hsk-1', 'HSK 1', 1, true from public.mandarin_courses where slug = 'curso-de-mandarin'
on conflict (course_id, slug) do nothing;

insert into public.mandarin_units (level_id, slug, title, order_index, is_published)
select l.id, 'unidad-1-introduccion', 'Unidad 1: Introducción', 1, true
from public.mandarin_levels l
join public.mandarin_courses c on c.id = l.course_id
where c.slug = 'curso-de-mandarin' and l.slug = 'hsk-1'
on conflict (level_id, slug) do nothing;

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('hola', 'Hola', 'Saludar y despedirse en mandarín.', 1),
  ('presentarse', 'Presentarse', 'Decir tu nombre y preguntar el de alguien más.', 2),
  ('pronombres', 'Pronombres', 'Usar 我, 你, 他/她 y sus plurales.', 3)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'hsk-1' and u.slug = 'unidad-1-introduccion'
on conflict (unit_id, slug) do nothing;

-- Vocabulary bank
insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('你好', 'nǐ hǎo', 'hola'),
  ('再见', 'zàijiàn', 'adiós'),
  ('谢谢', 'xièxiè', 'gracias'),
  ('我', 'wǒ', 'yo'),
  ('你', 'nǐ', 'tú'),
  ('他', 'tā', 'él'),
  ('她', 'tā', 'ella'),
  ('叫', 'jiào', 'llamarse'),
  ('名字', 'míngzi', 'nombre'),
  ('是', 'shì', 'ser/estar'),
  ('学生', 'xuéshēng', 'estudiante'),
  ('们', 'men', '(sufijo de plural para pronombres)')
on conflict do nothing;

-- Link vocab to "hola"
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('你好', 1), ('再见', 2), ('谢谢', 3)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'hola'
on conflict do nothing;

-- Link vocab to "presentarse"
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('我', 1), ('叫', 2), ('名字', 3), ('是', 4), ('学生', 5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'presentarse'
on conflict do nothing;

-- Link vocab to "pronombres"
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('我', 1), ('你', 2), ('他', 3), ('她', 4), ('们', 5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'pronombres'
on conflict do nothing;

-- Grammar
insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '是 como verbo "ser"', '是 (shì) funciona como el verbo "ser" en español: 我是学生 (wǒ shì xuéshēng) significa "yo soy estudiante". No se conjuga: se usa igual sin importar el sujeto.', 1
from public.mandarin_lessons where slug = 'presentarse'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Plural de pronombres con 们', 'Para hacer plural un pronombre se agrega 们 (men) al final: 我们 (wǒmen) es "nosotros", 你们 (nǐmen) es "ustedes", 他们/她们 (tāmen) es "ellos/ellas".', 1
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

-- Examples
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你好，我叫小明。', 'Nǐ hǎo, wǒ jiào Xiǎomíng.', 'Hola, me llamo Xiaoming.', 1
from public.mandarin_lessons where slug = 'hola'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我是学生。', 'Wǒ shì xuéshēng.', 'Soy estudiante.', 1
from public.mandarin_lessons where slug = 'presentarse'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他们是学生。', 'Tāmen shì xuéshēng.', 'Ellos son estudiantes.', 1
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

-- Exercises: 2 per lesson (1 vocab_multiple_choice + 1 sentence_order)
insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 你好?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '你好'),
    'options', jsonb_build_array('hola', 'adiós', 'gracias'), 'correct_option', 'hola'),
  1, true
from public.mandarin_lessons where slug = 'hola'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Hola, me llamo Xiaoming."',
  jsonb_build_object('tokens', jsonb_build_array('你好', '，', '我', '叫', '小明'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true
from public.mandarin_lessons where slug = 'hola'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 学生?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '学生'),
    'options', jsonb_build_array('estudiante', 'nombre', 'profesor'), 'correct_option', 'estudiante'),
  1, true
from public.mandarin_lessons where slug = 'presentarse'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Soy estudiante."',
  jsonb_build_object('tokens', jsonb_build_array('我', '是', '学生'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'presentarse'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 他们?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '他'),
    'options', jsonb_build_array('ellos', 'nosotros', 'ustedes'), 'correct_option', 'ellos'),
  1, true
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Ellos son estudiantes."',
  jsonb_build_object('tokens', jsonb_build_array('他们', '是', '学生'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;
