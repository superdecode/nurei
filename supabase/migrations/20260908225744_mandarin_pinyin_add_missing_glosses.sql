-- ============================================
-- MANDARIN: 汉语 and 才 were the only two example chips in the pinyin
-- lesson without a Spanish gloss inside the parenthetical (every
-- other chip follows "hanzi (pinyin, "gloss")" — these two only had
-- bare pinyin), so their chip showed no translation unlike the rest.
-- Glosses match each word's own vocab_items.es value.
-- ============================================

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  '汉语 (hànyǔ) lleva el sonido ü',
  '汉语 (hànyǔ, "idioma chino") lleva el sonido ü'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and explanation like '%汉语 (hànyǔ) lleva el sonido ü%';

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  '才 (cái) suena como "ts" en "gatsby".',
  '才 (cái, "apenas") suena como "ts" en "gatsby".'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and explanation like '%才 (cái) suena como "ts" en "gatsby".%';
