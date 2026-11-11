-- ============================================
-- MANDARIN: expand the 'pinyin' lesson with the two biggest remaining
-- sound-system gaps for Spanish speakers — aspiration (b/p, d/t, g/k,
-- j/q, z/c) and the u/ü distinction — plus matching practice. DEMO
-- content, original writing.
-- ============================================

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Consonantes con y sin aspiración: b/p, d/t, g/k, j/q, z/c', 'En español, "b" y "p" se diferencian porque una vibra las cuerdas vocales y la otra no. En mandarín, ninguna de las dos vibra — la diferencia real es la ASPIRACIÓN: cuánto aire sale al pronunciarlas. b, d, g, j y z salen CASI SIN aire, y suenan parecidas a una p/t/k/ch/ts española pero más suaves. p, t, k, q y c SÍ llevan una ráfaga de aire notable, más fuerte que cualquier consonante del español — parecida a la "p" del inglés "pin", no a la "p" española de "pino". Un truco práctico: pon una mano (o un trozo de papel) frente a la boca al decir pā — deberías sentir un golpe de aire claro; al decir bā, casi no debería moverse nada. Confundir estas parejas es uno de los errores más comunes de quien empieza, porque el oído hispanohablante busca la diferencia en la vibración, no en el aire.', 3
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Cuándo "u" en realidad suena como ü', 'Ya viste que ü es un sonido que no existe en español, con los labios redondeados como en la "u" francesa. La regla de escritura tiene una trampa: después de j, q, x o y, ese sonido ü SIEMPRE se escribe como "u" simple, sin los dos puntos — por ejemplo 去 (qù, "ir") se pronuncia con ü aunque se escriba con u normal, porque después de estas cuatro letras la u normal (como en español) ni siquiera es posible. La situación es distinta después de l o n: ahí SÍ puede haber una u normal (como en 路, lù, "camino") o una ü (como en 绿, lǜ, "verde") — por eso ahí sí se escriben los dos puntos cuando corresponde, para no confundir ambos sonidos. En resumen: después de j/q/x/y, "u" siempre suena ü; después de l/n, hay que fijarse en si lleva los dos puntos.', 4
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他去学校。', 'Tā qù xuéxiào.', 'Él va a la escuela.', 3
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué diferencia a "b" de "p" en pinyin?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '谢谢'),
    'options', jsonb_build_array('la cantidad de aire (aspiración)', 'si vibra la garganta', 'el tono'), 'correct_option', 'la cantidad de aire (aspiración)'),
  5, true
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', 'Después de j, q, x o y, la letra "u" en pinyin suena como...',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '汉语'),
    'options', jsonb_build_array('ü (labios redondeados)', 'u normal, como en español', 'o (como en "sol")'), 'correct_option', 'ü (labios redondeados)'),
  6, true
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Él va a la escuela."',
  jsonb_build_object('tokens', jsonb_build_array('他', '去', '学校'), 'correct_order', jsonb_build_array(0,1,2)),
  7, true
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 7
from public.mandarin_lessons les
join public.mandarin_vocab_items v2 on v2.hanzi = '去'
where les.slug = 'pinyin'
on conflict do nothing;
