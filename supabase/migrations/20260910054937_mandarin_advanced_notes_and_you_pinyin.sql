-- ============================================
-- MANDARIN: three fixes.
--
-- 1. The 'oraciones-negativas' lesson's negation explanation showed 有
-- with no pinyin at all ("negar 有 (tener/haber)"), inconsistent with
-- every other hanzi mention in the course.
--
-- 2. Introduces a reusable "advanced concept, don't worry if you don't
-- remember it yet" callout. LessonPlayer.tsx now recognizes a
-- [[AVANZADO]]...[[/AVANZADO]] marker inside grammar_points.explanation
-- and renders that span as a distinct reassurance callout instead of
-- plain body text. Applied here to the two existing tone-sandhi asides
-- (the 'tonos' lesson's third-tone sandhi note, and the
-- 'oraciones-negativas' lesson's 不→bú tone-change note) since both are
-- exactly the kind of "nice to know, not required yet" detail this
-- callout is meant for.
-- ============================================

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  'negar 有 (tener/haber)',
  'negar 有 (yǒu, "tener/haber")'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'oraciones-negativas')
  and explanation like '%negar 有 (tener/haber)%';

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  'Un detalle avanzado: cuando dos terceros tonos van seguidos, el primero se pronuncia casi como un segundo tono (esto se llama "sandhi tonal") — por ejemplo 你好 (nǐ hǎo) sale más como ní hǎo en el habla real, aunque se escriba con dos terceros tonos. Esta misma idea de "sandhi" aparece también con el adverbio de negación 不 (bù), que cambia de tono en ciertos contextos — lo verás con más detalle más adelante.',
  '[[AVANZADO]]Un detalle avanzado: cuando dos terceros tonos van seguidos, el primero se pronuncia casi como un segundo tono (esto se llama "sandhi tonal") — por ejemplo 你好 (nǐ hǎo) sale más como ní hǎo en el habla real, aunque se escriba con dos terceros tonos. Esta misma idea de "sandhi" aparece también con el adverbio de negación 不 (bù), que cambia de tono en ciertos contextos — lo verás con más detalle más adelante.[[/AVANZADO]]'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'tonos')
  and explanation like '%Un detalle avanzado: cuando dos terceros tonos van seguidos%';

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  'Un detalle de tonos importante: 不 normalmente se pronuncia con cuarto tono (bù), pero cambia a segundo tono (bú) cuando va justo antes de otra sílaba de cuarto tono — por eso "no ser" se escribe 不是 pero se pronuncia búshì, no bùshì. Este cambio concreto solo lo tiene 不; 没 nunca cambia de tono (recuerda que el sandhi de los terceros tonos, que ya viste, es otra regla distinta).',
  '[[AVANZADO]]Un detalle de tonos importante: 不 normalmente se pronuncia con cuarto tono (bù), pero cambia a segundo tono (bú) cuando va justo antes de otra sílaba de cuarto tono — por eso "no ser" se escribe 不是 pero se pronuncia búshì, no bùshì. Este cambio concreto solo lo tiene 不; 没 nunca cambia de tono (recuerda que el sandhi de los terceros tonos, que ya viste, es otra regla distinta).[[/AVANZADO]]'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'oraciones-negativas')
  and explanation like '%Un detalle de tonos importante: 不 normalmente se pronuncia%';
