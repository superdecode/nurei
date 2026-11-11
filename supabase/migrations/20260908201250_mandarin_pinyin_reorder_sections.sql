-- ============================================
-- MANDARIN: reorder the 'pinyin' lesson's grammar_points so related
-- topics sit next to each other (Consonantes, then Vocales) instead of
-- interleaved in creation order. No unique constraint exists on
-- order_index for this table, so the two updates below are safe
-- regardless of execution order.
-- ============================================

-- was 3 -> now 2 (right after the consonant-sounds intro)
update public.mandarin_grammar_points
set order_index = 2
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and title = 'Consonantes con y sin aspiración: b/p, d/t, g/k, j/q, z/c';

-- was 4 -> now 3 (vowel section, right after the consonant section)
update public.mandarin_grammar_points
set order_index = 3
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and title = 'Cuándo "u" en realidad suena como ü';

-- was 2 -> now 4 (syllable structure + tone marks moves to the end)
update public.mandarin_grammar_points
set order_index = 4
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and title = 'La estructura de una sílaba en pinyin';
