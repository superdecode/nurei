-- ============================================
-- MANDARIN: add missing explanation to the "hola" lesson.
-- The HSK1 seed (20260907211456) gave "presentarse" and "pronombres" a
-- grammar_points row each, but left "hola" with none — the lesson players
-- only render an "Introducción" section when grammar.length > 0, so this
-- lesson (usually the first one a student opens) showed vocab + example +
-- practice with no actual explanation of what's being taught.
-- ============================================

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Saludar y despedirse', '你好 (nǐ hǎo) es el saludo neutro que sirve a cualquier hora del día — no cambia según la hora, a diferencia del español. 谢谢 (xièxiè) se usa para dar las gracias, y se puede responder con 不客气 (bú kèqi, "de nada") aunque eso lo verás más adelante. 再见 (zàijiàn) es la despedida estándar, literalmente "volver a ver(nos)".', 1
from public.mandarin_lessons where slug = 'hola'
on conflict do nothing;
