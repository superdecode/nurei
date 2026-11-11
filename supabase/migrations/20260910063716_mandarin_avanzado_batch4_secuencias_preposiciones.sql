-- ============================================
-- MANDARIN: "Temas avanzados", batch 4 of 5 (order_index 21-25).
-- Position words (方位词), simultaneous/sequential actions
-- (一边...一边..., 先...然后...), range (从...到...), and the
-- prepositions 对/给/跟. DEMO ONLY, pending review by Elian. Original
-- writing — HanziBox's free course topic order used as reference only.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('palabras-de-posicion', 'Palabras de posición: 上/下/里/外/左/右/前/后', 'Ubicar objetos y lugares con palabras de posición y 在...上/里.', 21),
  ('yibian-yibian', 'Hacer dos cosas a la vez: 一边 (yìbiān)...一边 (yìbiān)...', 'Describir dos acciones simultáneas.', 22),
  ('xian-ranhou', 'Primero... luego...: 先 (xiān)...然后 (ránhòu)...', 'Ordenar acciones en una secuencia.', 23),
  ('cong-dao', 'De... a...: 从 (cóng)...到 (dào)...', 'Expresar un rango de lugar o tiempo.', 24),
  ('preposiciones-dui-gei-gen', 'Preposiciones 对 (duì) / 给 (gěi) / 跟 (gēn)', 'Dirigir una acción hacia o con alguien.', 25)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basico-avanzado' and u.slug = 'temas-avanzados'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('上', 'shàng', 'arriba / encima'),
  ('下', 'xià', 'abajo / debajo'),
  ('里', 'lǐ', 'dentro'),
  ('外', 'wài', 'fuera'),
  ('左', 'zuǒ', 'izquierda'),
  ('右', 'yòu', 'derecha'),
  ('前', 'qián', 'adelante / antes'),
  ('后', 'hòu', 'atrás / después'),
  ('一边', 'yìbiān', 'mientras (haciendo algo)'),
  ('先', 'xiān', 'primero'),
  ('然后', 'ránhòu', 'luego / después'),
  ('从', 'cóng', 'desde'),
  ('到', 'dào', 'hasta / llegar'),
  ('多长时间', 'duō cháng shíjiān', 'cuánto tiempo'),
  ('多久', 'duōjiǔ', 'cuánto tiempo (versión corta)'),
  ('对', 'duì', 'hacia / con respecto a / correcto'),
  ('给', 'gěi', 'a / para (dar algo a alguien)'),
  ('跟', 'gēn', 'con (junto a alguien)')
on conflict do nothing;

-- palabras-de-posicion
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('上',1),('下',2),('里',3),('外',4),('左',5),('右',6),('前',7),('后',8)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'palabras-de-posicion' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Palabras de posición y 在...上/里...', 'Las palabras de posición en chino se colocan DESPUÉS del sustantivo, al revés que las preposiciones en español: 桌子上 ("sobre la mesa", literalmente "mesa-arriba"), no "arriba de la mesa" en ese orden de palabras. Para decir dónde está algo, se combinan con 在 (el verbo "estar en" que ya conoces): 猫在桌子上 ("el gato está sobre la mesa"). Las ocho palabras de posición básicas son: 上 (shàng, "arriba/encima"), 下 (xià, "abajo/debajo"), 里 (lǐ, "dentro"), 外 (wài, "fuera"), 左 (zuǒ, "izquierda"), 右 (yòu, "derecha"), 前 (qián, "adelante/antes") y 后 (hòu, "atrás/después"). Es común añadir 面 (miàn) o 边 (biān) después de estas palabras sin cambiar el significado — 上面 y 上边 significan exactamente lo mismo que 上 solo, solo que suenan un poco más completos: 猫在桌子上面 es tan correcto como 猫在桌子上. [[AVANZADO]]前 y 后 también se usan para tiempo, no solo espacio — 以前 (yǐqián, "antes") y 以后 (yǐhòu, "después") son palabras compuestas relacionadas que verás en una lección aparte; por ahora, quédate solo con el sentido espacial de 前/后.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'palabras-de-posicion' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('猫在桌子上。', 'Māo zài zhuōzi shàng.', 'El gato está sobre la mesa.', 1),
  ('我的书在家里。', 'Wǒ de shū zài jiā lǐ.', 'Mi libro está en casa.', 2),
  ('狗在外边。', 'Gǒu zài wàibian.', 'El perro está afuera.', 3),
  ('学校在我家前面。', 'Xuéxiào zài wǒ jiā qiánmiàn.', 'La escuela está frente a mi casa.', 4),
  ('你的车在左边，我的车在右边。', 'Nǐ de chē zài zuǒbian, wǒ de chē zài yòubian.', 'Tu coche está a la izquierda, el mío está a la derecha.', 5),
  ('我朋友在我后面。', 'Wǒ péngyou zài wǒ hòumiàn.', 'Mi amigo está detrás de mí.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'palabras-de-posicion' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Dónde va la palabra de posición respecto al sustantivo?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '上'),
    'options', jsonb_build_array('después', 'antes', 'no importa'), 'correct_option', 'después'),
  1, true from public.mandarin_lessons where slug = 'palabras-de-posicion' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "El gato está sobre la mesa."',
  jsonb_build_object('tokens', jsonb_build_array('猫', '在', '桌子', '上'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'palabras-de-posicion' on conflict do nothing;

-- yibian-yibian
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 1 from public.mandarin_lessons les join public.mandarin_vocab_items v2 on v2.hanzi = '一边'
where les.slug = 'yibian-yibian' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '一边...一边... para dos acciones a la vez', '一边...一边... se usa para describir dos acciones que ocurren AL MISMO TIEMPO, con la estructura 一边 + verbo 1 + 一边 + verbo 2: 我一边吃米饭，一边看书 ("como arroz mientras leo un libro" — ambas acciones pasan a la vez). El sujeto va antes del primer 一边, y ambos verbos deben pertenecer a la misma persona — no puedes usar 一边...一边... para decir que dos personas distintas hacen cosas diferentes al mismo tiempo, solo para una misma persona haciendo dos cosas. El orden de los verbos no cambia mucho el significado, pero normalmente se pone primero la acción que sirve de "fondo": 一边喝茶，一边看书 suena tan natural como 一边看书，一边喝茶. [[AVANZADO]]一边...一边... solo funciona con dos acciones compatibles físicamente — no tendría sentido decir "一边睡觉，一边跑步" (dormir mientras corres), porque son físicamente incompatibles; esto es más una cuestión de sentido común que de gramática, pero vale la pena mencionarlo.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'yibian-yibian' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我一边吃米饭，一边看书。', 'Wǒ yìbiān chī mǐfàn, yìbiān kàn shū.', 'Como arroz mientras leo un libro.', 1),
  ('她一边喝茶，一边看书。', 'Tā yìbiān hē chá, yìbiān kàn shū.', 'Ella bebe té mientras lee un libro.', 2),
  ('我一边骑马，一边说汉语。', 'Wǒ yìbiān qí mǎ, yìbiān shuō hànyǔ.', 'Monto a caballo mientras hablo chino.', 3),
  ('你能一边喝水，一边看书吗？', 'Nǐ néng yìbiān hē shuǐ, yìbiān kàn shū ma?', '¿Puedes beber agua mientras lees un libro?', 4),
  ('我们一边说汉语，一边喝茶。', 'Wǒmen yìbiān shuō hànyǔ, yìbiān hē chá.', 'Hablamos chino mientras bebemos té.', 5),
  ('他一边看书，一边喝水。', 'Tā yìbiān kàn shū, yìbiān hē shuǐ.', 'Él lee un libro mientras bebe agua.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'yibian-yibian' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Para qué se usa 一边...一边...?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '一边'),
    'options', jsonb_build_array('dos acciones simultáneas', 'una secuencia de acciones', 'un contraste'), 'correct_option', 'dos acciones simultáneas'),
  1, true from public.mandarin_lessons where slug = 'yibian-yibian' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Como arroz mientras leo un libro."',
  jsonb_build_object('tokens', jsonb_build_array('我', '一边', '吃', '米饭', '一边', '看', '书'), 'correct_order', jsonb_build_array(0,1,2,3,4,5,6)),
  2, true from public.mandarin_lessons where slug = 'yibian-yibian' on conflict do nothing;

-- xian-ranhou
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('先',1),('然后',2)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'xian-ranhou' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '先...然后... para ordenar acciones', '先...然后... conecta dos acciones que ocurren EN ORDEN, una después de la otra — el equivalente a "primero...luego..." en español: 我先吃米饭，然后看书 ("primero como, luego leo"). A diferencia de 一边...一边..., que es para acciones simultáneas, 先...然后... deja claro que una acción termina ANTES de que empiece la siguiente. El sujeto normalmente va antes de 先, y no hace falta repetirlo antes de 然后 si es la misma persona: 我先去学校，然后去朋友家 (no hace falta decir "然后我去朋友家", aunque también sería correcto). [[AVANZADO]]先...然后... se puede extender a más de dos pasos añadiendo 再 (que ya conoces del "otra vez" en el futuro, pero aquí funciona como "luego" en una secuencia) entre medias: 先...然后...再..., para decir "primero A, luego B, después C". Por ahora, con dos pasos usando 先...然后... es más que suficiente.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'xian-ranhou' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我先吃米饭，然后看书。', 'Wǒ xiān chī mǐfàn, ránhòu kàn shū.', 'Primero como, luego leo.', 1),
  ('我先去学校，然后去朋友家。', 'Wǒ xiān qù xuéxiào, ránhòu qù péngyou jiā.', 'Primero voy a la escuela, luego voy a casa de mi amigo.', 2),
  ('你先说，然后我说。', 'Nǐ xiān shuō, ránhòu wǒ shuō.', 'Primero hablas tú, luego hablo yo.', 3),
  ('他先喝茶，然后喝水。', 'Tā xiān hē chá, ránhòu hē shuǐ.', 'Primero bebe té, luego bebe agua.', 4),
  ('我们先去，然后再来。', 'Wǒmen xiān qù, ránhòu zài lái.', 'Primero vamos, luego regresamos.', 5),
  ('先看这本书，然后看那本书。', 'Xiān kàn zhè běn shū, ránhòu kàn nà běn shū.', 'Primero lee este libro, luego ese.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'xian-ranhou' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué indica 先...然后...?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '然后'),
    'options', jsonb_build_array('una secuencia de acciones', 'dos acciones simultáneas', 'una comparación'), 'correct_option', 'una secuencia de acciones'),
  1, true from public.mandarin_lessons where slug = 'xian-ranhou' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Primero como, luego leo."',
  jsonb_build_object('tokens', jsonb_build_array('我', '先', '吃', '米饭', '然后', '看', '书'), 'correct_order', jsonb_build_array(0,1,2,3,4,5,6)),
  2, true from public.mandarin_lessons where slug = 'xian-ranhou' on conflict do nothing;

-- cong-dao
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('从',1),('到',2),('多长时间',3),('多久',4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'cong-dao' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '从...到... para un rango de lugar o tiempo', '从...到... marca un rango, ya sea de lugar o de tiempo, igual que "de...a..." en español: 从我家到学校 ("de mi casa a la escuela") para lugares, 从三点到五点 ("de las tres a las cinco") para tiempo. 从 marca el punto de partida, 到 marca el punto de llegada — el orden nunca cambia. 到 también funciona solo, como verbo, para decir que alguien "llega" a un lugar: 我到了 ("llegué"). Cuando 从...到... describe una distancia, es común preguntar cuánto tiempo toma con 多长时间 ("¿cuánto tiempo se necesita?"): 从我家到学校要多长时间? ("¿cuánto tiempo se tarda de mi casa a la escuela?"). [[AVANZADO]]多长时间 (duō cháng shíjiān) es la forma completa de preguntar duración; en el habla cotidiana también es común la versión más corta 多久 (duōjiǔ), que significa exactamente lo mismo — verás ambas formas usadas indistintamente.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'cong-dao' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('从我家到学校要一个小时。', 'Cóng wǒ jiā dào xuéxiào yào yí gè xiǎoshí.', 'De mi casa a la escuela se necesita una hora.', 1),
  ('从三点到五点，我在家。', 'Cóng sān diǎn dào wǔ diǎn, wǒ zài jiā.', 'De las tres a las cinco, estoy en casa.', 2),
  ('我到了。', 'Wǒ dào le.', 'Llegué.', 3),
  ('从星期一到星期五，我去学校。', 'Cóng xīngqīyī dào xīngqīwǔ, wǒ qù xuéxiào.', 'De lunes a viernes, voy a la escuela.', 4),
  ('从我家到学校要多长时间？', 'Cóng wǒ jiā dào xuéxiào yào duō cháng shíjiān?', '¿Cuánto tiempo toma de mi casa a la escuela?', 5),
  ('从今天到星期天，我在家。', 'Cóng jīntiān dào xīngqītiān, wǒ zài jiā.', 'De hoy a domingo, estoy en casa.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'cong-dao' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué palabra marca el punto de PARTIDA en 从...到...?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '从'),
    'options', jsonb_build_array('从', '到', '在'), 'correct_option', '从'),
  1, true from public.mandarin_lessons where slug = 'cong-dao' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Llegué."',
  jsonb_build_object('tokens', jsonb_build_array('我', '到', '了'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true from public.mandarin_lessons where slug = 'cong-dao' on conflict do nothing;

-- preposiciones-dui-gei-gen
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('对',1),('给',2),('跟',3)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'preposiciones-dui-gei-gen' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '对, 给 y 跟: tres formas distintas de "a/con"', '对, 给 y 跟 son tres palabras que en español a veces se traducen todas como "a" o "con", pero cada una tiene un uso distinto. 对 (duì) indica hacia quién o hacia qué va dirigida una actitud o acción: 我对你很好 ("soy bueno contigo", mi actitud va dirigida hacia ti). 对 también significa "correcto" cuando se usa solo, como respuesta: 对! ("¡correcto!"). 给 (gěi) marca a quién se le DA algo — se usa con verbos de transferencia como dar, regalar, mostrar: 我给你书 ("te doy el libro" — el libro pasa de mí a ti). 跟 (gēn) significa "con", en el sentido de "junto a" o "acompañado de", y se usa con verbos de acción compartida: 我跟你去 ("voy contigo", ambos vamos juntos) — nunca se usaría 对 o 给 en esa frase. [[AVANZADO]]对 y 跟 pueden confundirse porque ambos aparecen antes de una persona, pero la diferencia es la dirección: 对 es una actitud o acción que va HACIA alguien (no necesariamente compartida), mientras que 跟 implica que ambos hacen algo JUNTOS. "Soy bueno contigo" es 对, "voy contigo" es 跟.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'preposiciones-dui-gei-gen' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我对你很好。', 'Wǒ duì nǐ hěn hǎo.', 'Soy bueno contigo.', 1),
  ('对！', 'Duì!', '¡Correcto!', 2),
  ('我给你书。', 'Wǒ gěi nǐ shū.', 'Te doy el libro.', 3),
  ('我跟你去。', 'Wǒ gēn nǐ qù.', 'Voy contigo.', 4),
  ('他对我说汉语。', 'Tā duì wǒ shuō hànyǔ.', 'Él me habla en chino.', 5),
  ('我朋友跟我去学校。', 'Wǒ péngyou gēn wǒ qù xuéxiào.', 'Mi amigo va a la escuela conmigo.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'preposiciones-dui-gei-gen' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cuál se usa para decir "te doy algo"?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '给'),
    'options', jsonb_build_array('给', '对', '跟'), 'correct_option', '给'),
  1, true from public.mandarin_lessons where slug = 'preposiciones-dui-gei-gen' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Voy contigo."',
  jsonb_build_object('tokens', jsonb_build_array('我', '跟', '你', '去'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'preposiciones-dui-gei-gen' on conflict do nothing;
