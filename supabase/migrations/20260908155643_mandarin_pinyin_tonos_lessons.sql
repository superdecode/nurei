-- ============================================
-- MANDARIN: pinyin + tonos, the first 2 lessons anyone takes.
-- DEMO ONLY, pending review by Elian. Original writing.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('pinyin', 'El pinyin', 'Leer correctamente las letras del pinyin, que no siempre suenan como en español.', 1),
  ('tonos', 'Los tonos', 'Reconocer los 4 tonos del mandarín y por qué una misma sílaba puede significar cosas totalmente distintas.', 2)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'hsk-1' and u.slug = 'unidad-1-introduccion'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('汉语', 'hànyǔ', 'idioma chino (mandarín)'),
  ('日', 'rì', 'sol/día'),
  ('妈', 'mā', 'mamá (primer tono)'),
  ('麻', 'má', 'cáñamo/entumecido (segundo tono)'),
  ('马', 'mǎ', 'caballo (tercer tono)'),
  ('骂', 'mà', 'regañar/insultar (cuarto tono)'),
  ('骑', 'qí', 'montar (a caballo, bicicleta)')
on conflict do nothing;

-- Lesson: pinyin
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('你好', 1), ('谢谢', 2), ('汉语', 3), ('日', 4), ('吃', 5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'El pinyin no se lee como el español', 'El pinyin es el sistema oficial para escribir los sonidos del mandarín con letras latinas, pero varias letras representan sonidos que NO existen en español o que se escriben distinto de lo que esperarías. 谢谢 (xièxiè, "gracias") usa la x, que NO suena como la x de "México" ni como "ks" — suena como una "sh" suave, con la lengua más adelante que en inglés. 汉语 (hànyǔ) lleva el sonido ü aunque se escriba con u simple: cuando ese sonido va después de j, q, x o y se escribe "u" sin diéresis, porque en esa posición no hay ambigüedad posible; ese sonido ü es un sonido que no existe en español — se pronuncia con los labios redondeados, como la "u" francesa. 日 (rì, "sol/día") usa una r que tampoco es la r española: es un sonido retroflejo, con la punta de la lengua curvada hacia atrás, más parecido a la r del inglés, o a la j francesa de "jour", que a cualquier sonido del español. 吃 (chī, "comer") empieza con ch, otro sonido retroflejo (junto con zh y sh) que se pronuncia con la lengua enrollada hacia atrás, distinto del ch español de "chico". La letra c en pinyin (como en 才 cái) tampoco es una k ni una s: suena como "ts" en "gatsby". Todas estas letras existen precisamente porque el mandarín tiene sonidos que el español no tiene — el pinyin las recicla del alfabeto latino, pero les asigna un sonido nuevo.', 1
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '谢谢你说汉语。', 'Xièxiè nǐ shuō hànyǔ.', 'Gracias por hablar en chino.', 1
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cómo suena aproximadamente la "x" del pinyin en 谢谢?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '谢谢'),
    'options', jsonb_build_array('como una "sh" suave', 'como la "x" de México', 'como "ks"'), 'correct_option', 'como una "sh" suave'),
  1, true
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Gracias por hablar en chino."',
  jsonb_build_object('tokens', jsonb_build_array('谢谢', '你', '说', '汉语'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 6
from public.mandarin_lessons les
join public.mandarin_vocab_items v2 on v2.hanzi = '说'
where les.slug = 'pinyin'
on conflict do nothing;

-- Lesson: tonos
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('妈', 1), ('麻', 2), ('马', 3), ('骂', 4), ('骑', 5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Los 4 tonos (y el neutro)', 'El mandarín es una lengua tonal: la misma sílaba "ma" significa algo completamente distinto según el tono con el que se pronuncie. El ejemplo clásico que usan todos los cursos de chino: 妈 (mā, primer tono, plano y alto) es "mamá"; 麻 (má, segundo tono, ascendente, como si preguntaras "¿eh?") es "cáñamo" o "entumecido"; 马 (mǎ, tercer tono, que baja y luego sube, como si dudaras) es "caballo"; 骂 (mà, cuarto tono, que cae brusco, como una orden) es "regañar" o "insultar". Confundir el tono no es un simple acento raro — puede cambiar totalmente el significado de la frase. Existe además un quinto "tono neutro", corto y sin énfasis. Un detalle avanzado: cuando dos terceros tonos van seguidos, el primero se pronuncia casi como un segundo tono (esto se llama "sandhi tonal") — por ejemplo 你好 (nǐ hǎo) sale más como ní hǎo en el habla real, aunque se escriba con dos terceros tonos. Esta misma idea de "sandhi" aparece también con el adverbio de negación 不 (bù), que cambia de tono en ciertos contextos — lo verás con más detalle más adelante.', 1
from public.mandarin_lessons where slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '妈妈骑马。', 'Māma qí mǎ.', 'Mamá monta a caballo.', 1
from public.mandarin_lessons where slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué tono tiene 马 ("caballo")?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '马'),
    'options', jsonb_build_array('tercer tono', 'primer tono', 'cuarto tono'), 'correct_option', 'tercer tono'),
  1, true
from public.mandarin_lessons where slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Mamá monta a caballo."',
  jsonb_build_object('tokens', jsonb_build_array('妈妈', '骑', '马'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'tonos'
on conflict do nothing;
