-- ============================================
-- MANDARIN: add a casual parenthetical gloss to the last 2 technical
-- terms in the course that had no explanation nearby (audited the
-- whole course for jargon: verbos estativos, homógrafos, and erhuà
-- already carry an inline plain-language gloss; only these two didn't).
-- ============================================

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  'al escribir rápido o en teclados sin diacríticos: ma1',
  'al escribir rápido o en teclados sin diacríticos (los acentos que van sobre la vocal, como en ā, á, ǎ, à): ma1'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'tonos')
  and explanation like '%teclados sin diacríticos: ma1%';

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  'este segundo uso, llamado aspecto progresivo, es un tema más avanzado',
  'este segundo uso, llamado aspecto progresivo (o sea, una acción que está pasando justo en este momento), es un tema más avanzado'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'verbo-zai')
  and explanation like '%llamado aspecto progresivo, es un tema más avanzado%';
