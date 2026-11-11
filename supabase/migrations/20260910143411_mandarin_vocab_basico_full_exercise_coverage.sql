-- ============================================
-- MANDARIN: 'vocabulario-basico-util' teaches 15 words but only had
-- multiple-choice exercises for 2 of them. Adds one exercise per
-- remaining word (13 more, 15 total) so every word in the lesson can
-- be quizzed. Pairs with the LessonPlayer change that randomly
-- samples only 5 of a lesson's exercises per practice session when it
-- has more than 5 available, so this lesson's "Práctica" step now
-- quizzes a different random 5-of-15 subset each time instead of
-- always the same fixed 2.
-- ============================================

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select les.id, 'vocab_multiple_choice', v.prompt,
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = v.hanzi),
    'options', v.options, 'correct_option', v.correct),
  v.ord, true
from public.mandarin_lessons les
join (values
  ('茶', '¿Qué significa 茶?', jsonb_build_array('té', 'agua', 'dinero'), 'té', 3),
  ('米饭', '¿Qué significa 米饭?', jsonb_build_array('arroz (cocido)', 'agua', 'té'), 'arroz (cocido)', 4),
  ('钱', '¿Qué significa 钱?', jsonb_build_array('dinero', 'tiempo', 'hoy'), 'dinero', 5),
  ('时间', '¿Qué significa 时间?', jsonb_build_array('tiempo', 'hoy', 'ahora'), 'tiempo', 6),
  ('今天', '¿Qué significa 今天?', jsonb_build_array('hoy', 'ahora', 'tiempo'), 'hoy', 7),
  ('朋友', '¿Qué significa 朋友?', jsonb_build_array('amigo/a', 'profesor/a', 'estudiante'), 'amigo/a', 8),
  ('老师', '¿Qué significa 老师?', jsonb_build_array('profesor/a', 'estudiante', 'amigo/a'), 'profesor/a', 9),
  ('学生', '¿Qué significa 学生?', jsonb_build_array('estudiante', 'profesor/a', 'amigo/a'), 'estudiante', 10),
  ('家', '¿Qué significa 家?', jsonb_build_array('casa/familia', 'coche/vehículo', 'libro'), 'casa/familia', 11),
  ('猫', '¿Qué significa 猫?', jsonb_build_array('gato', 'perro', 'coche/vehículo'), 'gato', 12),
  ('狗', '¿Qué significa 狗?', jsonb_build_array('perro', 'gato', 'libro'), 'perro', 13),
  ('书', '¿Qué significa 书?', jsonb_build_array('libro', 'coche/vehículo', 'casa/familia'), 'libro', 14),
  ('车', '¿Qué significa 车?', jsonb_build_array('coche/vehículo', 'libro', 'casa/familia'), 'coche/vehículo', 15)
) as v(hanzi, prompt, options, correct, ord) on true
where les.slug = 'vocabulario-basico-util'
on conflict do nothing;
