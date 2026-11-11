-- ============================================
-- MANDARIN: "Gramática — Básico avanzado" / "Temas avanzados", batch 1
-- of a 25-lesson expansion (order_index 6-10 — the unit already had
-- 5 lessons at order_index 1-5 from an earlier migration). Topics:
-- 了 (completion), 在/正在 (progressive), and the three "poder" modal
-- verbs 能/会/可以. DEMO ONLY, pending review by Elian. Original
-- writing — HanziBox's free course topic order used as reference only.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('le-completado', 'El aspecto completado: 了 (le)', 'Usar 了 para marcar que una acción ya sucedió o que algo cambió.', 6),
  ('zai-progresivo', 'El aspecto progresivo: 在 / 正在 (zhèngzài)', 'Decir que algo está sucediendo en este momento.', 7),
  ('modal-neng', 'El verbo modal 能 (néng)', 'Expresar capacidad física o posibilidad.', 8),
  ('modal-hui', 'El verbo modal 会 (huì)', 'Expresar habilidades aprendidas, y diferenciarlo de 能.', 9),
  ('modal-keyi', 'El verbo modal 可以 (kěyǐ)', 'Pedir y dar permiso, y repasar la diferencia entre 能, 会 y 可以.', 10)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basico-avanzado' and u.slug = 'temas-avanzados'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('了', 'le', 'partícula de acción completada / cambio de estado'),
  ('正在', 'zhèngzài', 'justo ahora (partícula de progreso)'),
  ('呢', 'ne', 'partícula que refuerza que algo sigue en curso'),
  ('能', 'néng', 'poder / ser capaz de (capacidad o circunstancia)'),
  ('会', 'huì', 'saber hacer algo (habilidad aprendida)'),
  ('可以', 'kěyǐ', 'poder / tener permiso para')
on conflict do nothing;

-- le-completado
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 1 from public.mandarin_lessons les join public.mandarin_vocab_items v2 on v2.hanzi = '了'
where les.slug = 'le-completado' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '了 marca que una acción ya terminó', '了 (le) es una partícula que se coloca después del verbo para señalar que la acción ya se completó — es la forma más común de hablar del pasado en chino, ya que (como viste en la lección de los verbos) el verbo mismo nunca cambia de forma. 我吃了 ("comí"/"ya comí") añade 了 justo después de 吃 para mostrar que la acción de comer ya terminó. Si la acción tiene un objeto, 了 se coloca entre el verbo y el objeto: 我吃了米饭 ("comí arroz") — 了 va pegado al verbo 吃, antes de 米饭, no al final de toda la frase. 了 también puede ir al final de toda la frase para marcar un cambio de estado o una situación nueva, no solo una acción completada: 我要去学校了 ("ya me voy a la escuela") indica que algo cambió respecto a antes. [[AVANZADO]]Esta doble función de 了 — marcar una acción terminada justo después del verbo, o marcar un cambio de situación al final de la frase — es una de las partes más confusas del mandarín para hablantes de español, y muchos estudiantes tardan meses en sentirse cómodos distinguiendo ambos usos. Por ahora, basta con reconocer que 了 aparece cerca de un verbo para señalar que "ya pasó" o "ya cambió" — el resto vendrá con la práctica.[[/AVANZADO]] Una diferencia importante: 了 no se usa para negar el pasado — eso ya lo viste, se hace con 没 (méi): 我没吃 ("no comí"), nunca 我不了吃 en ese sentido.', 1
from public.mandarin_lessons where slug = 'le-completado' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我吃了。', 'Wǒ chī le.', 'Comí. / Ya comí.', 1),
  ('我吃了米饭。', 'Wǒ chī le mǐfàn.', 'Comí arroz.', 2),
  ('他去了学校。', 'Tā qù le xuéxiào.', 'Él fue a la escuela.', 3),
  ('你看了书吗？', 'Nǐ kàn le shū ma?', '¿Leíste el libro?', 4),
  ('我说了。', 'Wǒ shuō le.', 'Ya lo dije.', 5),
  ('我要去学校了。', 'Wǒ yào qù xuéxiào le.', 'Ya me voy a la escuela.', 6),
  ('我没吃米饭。', 'Wǒ méi chī mǐfàn.', 'No comí arroz.', 7)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'le-completado' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué indica 了 justo después de un verbo?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '了'),
    'options', jsonb_build_array('acción completada', 'acción futura', 'negación'), 'correct_option', 'acción completada'),
  1, true from public.mandarin_lessons where slug = 'le-completado' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Comí arroz."',
  jsonb_build_object('tokens', jsonb_build_array('我', '吃', '了', '米饭'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'le-completado' on conflict do nothing;

-- zai-progresivo
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('正在', 1), ('呢', 2)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'zai-progresivo' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '在 / 正在 para acciones en curso', '在 (zài), que ya conoces como "estar en un lugar", tiene un segundo uso: colocado justo antes de un verbo, indica que la acción está sucediendo en este momento — el equivalente al gerundio español ("-ando"/"-iendo"). 我在吃米饭 significa "estoy comiendo arroz" (ahora mismo), no "estoy en comer arroz". Para dejarlo aún más claro, se puede usar 正在 (zhèngzài) en vez de 在 solo, sin cambiar el significado — 正 (zhèng) simplemente enfatiza el "justo ahora": 我正在吃米饭 y 我在吃米饭 dicen lo mismo, solo que la primera suena un poco más enfática. Es común además añadir la partícula 呢 (ne) al final de la frase para reforzar que la acción sigue en curso: 我在吃米饭呢 ("estoy comiendo arroz, ¿ves?"). [[AVANZADO]]A diferencia del español, el chino no tiene que marcar el progresivo obligatoriamente — una frase sin 在/正在 también puede entenderse como una acción en curso según el contexto. 在/正在 solo se añaden cuando quieres dejar explícito que algo ocurre justo en este momento.[[/AVANZADO]] No confundas este 在 con el 在 de lugar: si va justo antes de un verbo es progresivo, si va antes de un lugar (en 在学校, "en la escuela") es el verbo "estar en".', 1
from public.mandarin_lessons where slug = 'zai-progresivo' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我在吃米饭。', 'Wǒ zài chī mǐfàn.', 'Estoy comiendo arroz.', 1),
  ('她正在看书。', 'Tā zhèngzài kàn shū.', 'Ella está leyendo un libro.', 2),
  ('你在说什么？', 'Nǐ zài shuō shénme?', '¿Qué estás diciendo?', 3),
  ('我们在学校。', 'Wǒmen zài xuéxiào.', 'Estamos en la escuela.', 4),
  ('他正在骑马。', 'Tā zhèngzài qí mǎ.', 'Él está montando a caballo.', 5),
  ('我在吃米饭呢。', 'Wǒ zài chī mǐfàn ne.', 'Estoy comiendo arroz, ¿ves?', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'zai-progresivo' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué indica 在 justo antes de un verbo?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '正在'),
    'options', jsonb_build_array('acción en curso', 'acción pasada', 'pregunta'), 'correct_option', 'acción en curso'),
  1, true from public.mandarin_lessons where slug = 'zai-progresivo' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Ella está leyendo un libro."',
  jsonb_build_object('tokens', jsonb_build_array('她', '正在', '看', '书'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'zai-progresivo' on conflict do nothing;

-- modal-neng
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 1 from public.mandarin_lessons les join public.mandarin_vocab_items v2 on v2.hanzi = '能'
where les.slug = 'modal-neng' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '能 para expresar posibilidad', '能 (néng) es un verbo modal que se coloca antes de otro verbo para expresar que algo ES POSIBLE hacer, ya sea por capacidad física o porque las circunstancias lo permiten: 我能去 ("puedo ir" — nada me lo impide). Se niega con 不能 (bù néng, "no poder"): 我不能去 ("no puedo ir"). Las preguntas de sí/no se forman igual que con cualquier otro verbo, añadiendo 吗 al final o repitiendo la forma afirmativa-negativa: 你能去吗? o 你能不能去?, ambas significan "¿puedes ir?". [[AVANZADO]]能 es el primero de tres verbos modales que en español se traducen todos como "poder" (能, 会, 可以) — cada uno cubre un matiz distinto: capacidad o circunstancia, habilidad aprendida, o permiso. Verás 会 y 可以 en las próximas dos lecciones; por ahora, quédate solo con que 能 es el más general de los tres.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'modal-neng' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我能去。', 'Wǒ néng qù.', 'Puedo ir.', 1),
  ('我不能去。', 'Wǒ bù néng qù.', 'No puedo ir.', 2),
  ('你能去吗？', 'Nǐ néng qù ma?', '¿Puedes ir?', 3),
  ('他能吃很多米饭。', 'Tā néng chī hěn duō mǐfàn.', 'Él puede comer mucho arroz.', 4),
  ('你能看那本书吗？', 'Nǐ néng kàn nà běn shū ma?', '¿Puedes leer ese libro?', 5),
  ('我们能去吗？', 'Wǒmen néng qù ma?', '¿Podemos ir?', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'modal-neng' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cómo se niega 能?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '能'),
    'options', jsonb_build_array('不能', '没能', '不是'), 'correct_option', '不能'),
  1, true from public.mandarin_lessons where slug = 'modal-neng' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "¿Puedes ir?"',
  jsonb_build_object('tokens', jsonb_build_array('你', '能', '去', '吗'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'modal-neng' on conflict do nothing;

-- modal-hui
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 1 from public.mandarin_lessons les join public.mandarin_vocab_items v2 on v2.hanzi = '会'
where les.slug = 'modal-hui' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '会 para habilidades aprendidas', '会 (huì) también se traduce como "poder" o "saber", pero se usa específicamente para habilidades que se aprendieron con estudio o práctica — un idioma, un instrumento, un oficio: 我会说汉语 ("sé hablar chino" — lo aprendí). Se niega con 不会 (bù huì): 我不会说汉语 ("no sé hablar chino"). La diferencia con 能 es clave: 能 habla de si algo es POSIBLE en este momento (capacidad o circunstancia), mientras que 会 habla de si SABES hacer algo porque lo aprendiste. Un hablante nativo de chino nunca diría 我能说汉语 para decir que sabe chino — sonaría tan raro como decir en español "soy capaz de hablar chino" en vez de "sé hablar chino". [[AVANZADO]]Hay un matiz más: cuando algo es posible gracias a una habilidad aprendida y además las circunstancias lo permiten, a veces se pueden usar ambos verbos sin gran diferencia — pero el default para "saber [idioma/habilidad]" es siempre 会, nunca 能. Confundir estos dos es el error más común de quien empieza a usar verbos modales en chino.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'modal-hui' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我会说汉语。', 'Wǒ huì shuō hànyǔ.', 'Sé hablar chino.', 1),
  ('我不会说汉语。', 'Wǒ bú huì shuō hànyǔ.', 'No sé hablar chino.', 2),
  ('你会骑马吗？', 'Nǐ huì qí mǎ ma?', '¿Sabes montar a caballo?', 3),
  ('他会说汉语，我不会。', 'Tā huì shuō hànyǔ, wǒ bú huì.', 'Él sabe hablar chino, yo no.', 4),
  ('我朋友会说汉语。', 'Wǒ péngyou huì shuō hànyǔ.', 'Mi amigo sabe hablar chino.', 5),
  ('你会不会说汉语？', 'Nǐ huì bú huì shuō hànyǔ?', '¿Sabes hablar chino o no?', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'modal-hui' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Para qué se usa 会?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '会'),
    'options', jsonb_build_array('habilidad aprendida', 'posesión', 'ubicación'), 'correct_option', 'habilidad aprendida'),
  1, true from public.mandarin_lessons where slug = 'modal-hui' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Sé hablar chino."',
  jsonb_build_object('tokens', jsonb_build_array('我', '会', '说', '汉语'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'modal-hui' on conflict do nothing;

-- modal-keyi
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 1 from public.mandarin_lessons les join public.mandarin_vocab_items v2 on v2.hanzi = '可以'
where les.slug = 'modal-keyi' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '可以 para pedir y dar permiso', '可以 (kěyǐ) es el tercer verbo modal que se traduce como "poder": se usa para pedir o dar PERMISO. 我可以去吗? ("¿puedo ir?", ¿me dejan?) es una pregunta de permiso, distinta de 我能去吗? (¿es posible/tengo la capacidad de ir?). Para negar el permiso, lo más natural no es 不可以, sino 不能: 你不能去 ("no puedes ir", te lo prohíbo o las circunstancias no lo permiten) es mucho más común que 你不可以去, aunque ambas formas existen y se entienden igual. [[AVANZADO]]Esta asimetría — 可以 para preguntar o dar permiso, pero 不能 (no 不可以) para negarlo — es una de las pequeñas irregularidades del chino que simplemente hay que memorizar; no te preocupes si al principio te sale decir 不可以, se entiende perfectamente, solo que 不能 suena un poco más natural.[[/AVANZADO]] Ahora que viste los tres verbos modales de "poder", aquí tienes el resumen: 能 = es posible (capacidad o circunstancia), 会 = sé hacerlo (habilidad aprendida), 可以 = tengo permiso.', 1
from public.mandarin_lessons where slug = 'modal-keyi' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我可以去吗？', 'Wǒ kěyǐ qù ma?', '¿Puedo ir?', 1),
  ('可以。', 'Kěyǐ.', 'Sí, puedes.', 2),
  ('你可以吃这个。', 'Nǐ kěyǐ chī zhège.', 'Puedes comer esto.', 3),
  ('你不能去。', 'Nǐ bù néng qù.', 'No puedes ir.', 4),
  ('我可以看你的书吗？', 'Wǒ kěyǐ kàn nǐ de shū ma?', '¿Puedo ver tu libro?', 5),
  ('这儿可以说汉语。', 'Zhèr kěyǐ shuō hànyǔ.', 'Aquí se puede hablar chino.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'modal-keyi' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué verbo modal se usa para pedir permiso?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '可以'),
    'options', jsonb_build_array('可以', '会', '了'), 'correct_option', '可以'),
  1, true from public.mandarin_lessons where slug = 'modal-keyi' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "¿Puedo ir?"',
  jsonb_build_object('tokens', jsonb_build_array('我', '可以', '去', '吗'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'modal-keyi' on conflict do nothing;
