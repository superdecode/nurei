-- ============================================
-- MANDARIN: two fixes.
--
-- 1. 它 (tā, "it", for objects/animals) is a true homophone of 他/她
-- (both also tā) - reuses that same recording instead of staying
-- silent.
--
-- 2. The 'verbos' lesson's explanation had two problems: 昨天/明天
-- were shown with no pinyin at all ("(昨天, "ayer", 明天, "mañana")"),
-- and the word-by-word gloss of 我们去学校 read as a run-on phrase
-- ("nosotros vamos escuela") instead of showing the word boundaries.
-- ============================================

update public.mandarin_vocab_items
set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/b/bb/LL-Q9192_%28cmn%29-Luilui6666-%E4%BB%96.wav'
where hanzi = '它';

update public.mandarin_grammar_points
set explanation = replace(
  replace(
    explanation,
    'con palabras de tiempo (昨天, "ayer", 明天, "mañana") o partículas',
    'con palabras de tiempo — 昨天 (zuótiān, "ayer") o 明天 (míngtiān, "mañana") — o partículas'
  ),
  'es literalmente "nosotros vamos escuela"',
  'es literalmente "nosotros + vamos + escuela"'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'verbos')
  and explanation like '%con palabras de tiempo (昨天, "ayer", 明天, "mañana") o partículas%';
