-- ============================================
-- MANDARIN: drop the unexplained "SVO" linguistics jargon from the
-- 'verbos' lesson (Gramática — Básico). This is a beginner course in
-- Spanish; a raw grammar abbreviation with no expansion has no place
-- in the title or body. Rewritten in plain, casual language instead.
-- ============================================

update public.mandarin_grammar_points
set title = 'Los verbos no se conjugan, y el orden de la oración',
    explanation = 'Los verbos chinos jamás se conjugan: la misma forma sirve para "yo como", "tú comes" o "ellos comieron" — el tiempo se indica con palabras de tiempo (昨天, "ayer", 明天, "mañana") o partículas que verás en lecciones futuras (了, 过, 在), nunca cambiando el verbo mismo. Esto hace que aprender verbos chinos sea, en cierto sentido, más simple que en español: no hay que memorizar conjugaciones. El orden básico de una oración china es el mismo que en español: primero quién hace la acción, luego el verbo, y al final lo que recibe la acción. Por ejemplo, 我们去学校 (Wǒmen qù xuéxiào) es literalmente "nosotros vamos escuela", es decir "Nosotros vamos a la escuela". Una diferencia importante: en chino no se puede omitir quién hace la acción tan libremente como en español (en español "voy a la escuela" omite el "yo"; en chino se prefiere decir 我去学校 de forma explícita, aunque en conversación informal a veces también se omite si es obvio por el contexto).'
where lesson_id = (select id from public.mandarin_lessons where slug = 'verbos')
  and title = 'Verbos invariables y orden SVO';
