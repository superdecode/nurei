-- ============================================
-- MANDARIN: "Temas avanzados", batch 5 of 5 (order_index 26-30) —
-- final batch of the 25-lesson expansion. Duration words, 以前/以后,
-- 已经...了, 还是 vs 或者, and transportation verbs. DEMO ONLY, pending
-- review by Elian. Original writing — HanziBox's free course topic
-- order used as reference only.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('duracion-tiempo', 'Expresar duración: 天 (tiān) / 星期 / 月 / 年', 'Decir cuánto tiempo dura algo usando palabras de duración.', 26),
  ('zhiqian-zhihou', 'Antes y después: 以前 (yǐqián) / 以后 (yǐhòu)', 'Ubicar acciones en el tiempo.', 27),
  ('yijing-le', 'Ya: 已经 (yǐjīng)...了', 'Decir que algo ya sucedió o ya cambió.', 28),
  ('haishi-vs-huozhe', '还是 (háishi) vs 或者 (huòzhě): decir "o"', 'Diferenciar 还是 (preguntas) y 或者 (afirmaciones).', 29),
  ('medios-de-transporte', 'Medios de transporte: 走路 (zǒulù) / 开车 (kāichē) / 坐 (zuò)...', 'Decir cómo te trasladas con los verbos de transporte más comunes.', 30)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basico-avanzado' and u.slug = 'temas-avanzados'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('天', 'tiān', 'día (duración)'),
  ('分钟', 'fēnzhōng', 'minuto (duración)'),
  ('学', 'xué', 'estudiar / aprender'),
  ('以前', 'yǐqián', 'antes'),
  ('以后', 'yǐhòu', 'después'),
  ('已经', 'yǐjīng', 'ya'),
  ('还是', 'háishi', 'o (en preguntas de opción)'),
  ('或者', 'huòzhě', 'o (en afirmaciones)'),
  ('走路', 'zǒulù', 'caminar / ir a pie'),
  ('开车', 'kāichē', 'conducir / manejar'),
  ('坐', 'zuò', 'sentarse / tomar un vehículo'),
  ('地铁', 'dìtiě', 'metro (transporte)'),
  ('飞机', 'fēijī', 'avión')
on conflict do nothing;

-- duracion-tiempo
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('天',1),('分钟',2),('学',3)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'duracion-tiempo' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Palabras de duración', 'Ya aprendiste a preguntar la hora en el reloj con 点, y la duración en horas con 小时. Para otras unidades de duración, el patrón es número + palabra: 三天 ("tres días"), 两个星期 ("dos semanas" — aquí sí se necesita el clasificador 个, igual que con 小时), 五个月 ("cinco meses"), 两年 ("dos años" — 年 no necesita clasificador, igual que 天). Para minutos como DURACIÓN (no como parte de la hora del reloj), se usa 分钟 (fēnzhōng), no 分 solo: 五分钟 ("cinco minutos", una duración) es distinto de 五点五分 ("las cinco y cinco", un punto del reloj) — 分 solo se usa dentro de una hora específica, 分钟 se usa para contar minutos como cantidad de tiempo. [[AVANZADO]]Fíjate en qué palabras de duración necesitan el clasificador 个 y cuáles no: 天 y 年 NO lo necesitan (三天, 两年), pero 星期, 小时 y 月 SÍ lo necesitan (三个星期, 两个小时, 五个月) — esto no sigue una regla lógica clara, simplemente hay que memorizarlo por cada palabra.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'duracion-tiempo' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我在这儿三天。', 'Wǒ zài zhèr sān tiān.', 'Estoy aquí tres días.', 1),
  ('我们有两个星期。', 'Wǒmen yǒu liǎng gè xīngqī.', 'Tenemos dos semanas.', 2),
  ('他学汉语五个月了。', 'Tā xué hànyǔ wǔ gè yuè le.', 'Él lleva cinco meses estudiando chino.', 3),
  ('我们在这儿两年了。', 'Wǒmen zài zhèr liǎng nián le.', 'Llevamos dos años aquí.', 4),
  ('一个小时有六十分钟。', 'Yí gè xiǎoshí yǒu liùshí fēnzhōng.', 'Una hora tiene sesenta minutos.', 5),
  ('我学汉语三个月了。', 'Wǒ xué hànyǔ sān gè yuè le.', 'Llevo tres meses estudiando chino.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'duracion-tiempo' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué palabra se usa para minutos como DURACIÓN (no en el reloj)?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '分钟'),
    'options', jsonb_build_array('分钟', '分', '点'), 'correct_option', '分钟'),
  1, true from public.mandarin_lessons where slug = 'duracion-tiempo' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Tenemos dos semanas."',
  jsonb_build_object('tokens', jsonb_build_array('我们', '有', '两', '个', '星期'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true from public.mandarin_lessons where slug = 'duracion-tiempo' on conflict do nothing;

-- zhiqian-zhihou
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('以前',1),('以后',2)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'zhiqian-zhihou' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '以前/以后 para ubicar en el tiempo', '以前 (yǐqián, "antes") y 以后 (yǐhòu, "después") se colocan DESPUÉS de la frase o palabra de tiempo a la que se refieren, nunca antes — al revés que en español: 五点以前 ("antes de las cinco"), 三天以后 ("después de tres días", o "en tres días"). También pueden ir después de toda una oración para decir "antes de que..." o "después de que...": 我去学校以前，我吃米饭 ("antes de ir a la escuela, como" — literalmente "yo voy a la escuela antes, yo como"). Usados solos, sin nada delante, significan "antes" y "después" en general, respecto a ahora: 以前我不会说汉语 ("antes no sabía hablar chino"), 以后我会说汉语 ("después sabré hablar chino"). [[AVANZADO]]以前/以后 vienen de 前/后 (las palabras de posición espacial que ya viste) más 以 — este patrón de convertir una posición espacial en una posición temporal añadiendo 以 es productivo en chino, aunque no necesitas memorizar la regla general todavía, solo estas dos palabras.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'zhiqian-zhihou' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('五点以前，我在家。', 'Wǔ diǎn yǐqián, wǒ zài jiā.', 'Antes de las cinco, estoy en casa.', 1),
  ('三天以后，我去中国。', 'Sān tiān yǐhòu, wǒ qù Zhōngguó.', 'En tres días, voy a China.', 2),
  ('以前我不会说汉语。', 'Yǐqián wǒ bú huì shuō hànyǔ.', 'Antes no sabía hablar chino.', 3),
  ('以后我会说汉语。', 'Yǐhòu wǒ huì shuō hànyǔ.', 'Después sabré hablar chino.', 4),
  ('我去学校以前，我吃米饭。', 'Wǒ qù xuéxiào yǐqián, wǒ chī mǐfàn.', 'Antes de ir a la escuela, como arroz.', 5),
  ('星期五以后，我在家。', 'Xīngqīwǔ yǐhòu, wǒ zài jiā.', 'Después del viernes, estoy en casa.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'zhiqian-zhihou' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Dónde va 以前/以后 respecto a la palabra de tiempo?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '以前'),
    'options', jsonb_build_array('después', 'antes', 'no importa'), 'correct_option', 'después'),
  1, true from public.mandarin_lessons where slug = 'zhiqian-zhihou' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Antes no sabía hablar chino."',
  jsonb_build_object('tokens', jsonb_build_array('以前', '我', '不会', '说', '汉语'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true from public.mandarin_lessons where slug = 'zhiqian-zhihou' on conflict do nothing;

-- yijing-le
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 1 from public.mandarin_lessons les join public.mandarin_vocab_items v2 on v2.hanzi = '已经'
where les.slug = 'yijing-le' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '已经...了 para reforzar el "ya"', '已经 (yǐjīng, "ya") se coloca antes del verbo, y casi siempre se combina con 了 al final de la frase para reforzar que algo YA pasó o YA cambió: 我已经吃了 ("ya comí"). Aunque técnicamente puedes usar 了 solo, sin 已经, para marcar una acción completada (como viste en la lección de 了), añadir 已经 pone mucho más énfasis en el "YA" — la diferencia es parecida a decir "comí" versus "YA comí" en español. 已经...了 también funciona con cambios de estado, no solo acciones: 他已经是学生了 ("él ya es estudiante" — antes no lo era, ahora sí). Una pregunta común con esta estructura es X已经...了吗?: 你已经吃了吗? ("¿ya comiste?"). [[AVANZADO]]La respuesta negativa a esta pregunta no es simplemente 不 o 没 solos — se responde 还没 (hái méi, "todavía no"): 还没吃 ("todavía no he comido"). 还 (hái, "todavía/además") ya lo conoces del curso; combinado con 没 forma esta respuesta muy común que verás todo el tiempo en conversación real.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'yijing-le' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我已经吃了。', 'Wǒ yǐjīng chī le.', 'Ya comí.', 1),
  ('他已经是学生了。', 'Tā yǐjīng shì xuéshēng le.', 'Él ya es estudiante.', 2),
  ('你已经吃了吗？', 'Nǐ yǐjīng chī le ma?', '¿Ya comiste?', 3),
  ('还没吃。', 'Hái méi chī.', 'Todavía no he comido.', 4),
  ('我已经会说汉语了。', 'Wǒ yǐjīng huì shuō hànyǔ le.', 'Ya sé hablar chino.', 5),
  ('他们已经去学校了。', 'Tāmen yǐjīng qù xuéxiào le.', 'Ellos ya fueron a la escuela.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'yijing-le' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cómo se responde "todavía no" a una pregunta con 已经...了吗?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '已经'),
    'options', jsonb_build_array('还没', '不是', '没有了'), 'correct_option', '还没'),
  1, true from public.mandarin_lessons where slug = 'yijing-le' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Ya comí."',
  jsonb_build_object('tokens', jsonb_build_array('我', '已经', '吃', '了'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'yijing-le' on conflict do nothing;

-- haishi-vs-huozhe
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('还是',1),('或者',2)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'haishi-vs-huozhe' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '还是 para preguntas, 或者 para afirmaciones', '还是 (háishi) y 或者 (huòzhě) ambos se traducen como "o", pero se usan en contextos distintos y NO son intercambiables. 还是 se usa en preguntas de opción, cuando le pides a alguien que elija entre dos cosas: 你要茶还是水? ("¿quieres té o agua?" — una pregunta real, esperando que elijan). 或者 se usa en afirmaciones, cuando mencionas dos opciones sin pedir que se elija una: 你可以喝茶或者喝水 ("puedes beber té o agua" — cualquiera de las dos está bien, no es una pregunta). La forma más fácil de recordarlo: si es una pregunta que ofrece opciones, es 还是; si es una afirmación con opciones, es 或者. [[AVANZADO]]Usar 或者 dentro de una pregunta (你要茶或者水?) es un error muy común de quien aprende chino como segunda lengua, y aunque a veces se entiende por contexto, suena claramente incorrecto para un hablante nativo — vale la pena prestarle atención a esta distinción desde el principio.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'haishi-vs-huozhe' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('你要茶还是水？', 'Nǐ yào chá háishi shuǐ?', '¿Quieres té o agua?', 1),
  ('你可以喝茶或者喝水。', 'Nǐ kěyǐ hē chá huòzhě hē shuǐ.', 'Puedes beber té o agua.', 2),
  ('你去学校还是去朋友家？', 'Nǐ qù xuéxiào háishi qù péngyou jiā?', '¿Vas a la escuela o a casa de tu amigo?', 3),
  ('我们可以说汉语或者说英语。', 'Wǒmen kěyǐ shuō hànyǔ huòzhě shuō yīngyǔ.', 'Podemos hablar chino o inglés.', 4),
  ('你是学生还是老师？', 'Nǐ shì xuéshēng háishi lǎoshī?', '¿Eres estudiante o profesor?', 5),
  ('星期六或者星期天，我都可以。', 'Xīngqīliù huòzhě xīngqītiān, wǒ dōu kěyǐ.', 'El sábado o el domingo, ambos me van bien.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'haishi-vs-huozhe' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cuál se usa en una PREGUNTA de opción?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '还是'),
    'options', jsonb_build_array('还是', '或者', '但是'), 'correct_option', '还是'),
  1, true from public.mandarin_lessons where slug = 'haishi-vs-huozhe' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "¿Quieres té o agua?"',
  jsonb_build_object('tokens', jsonb_build_array('你', '要', '茶', '还是', '水'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true from public.mandarin_lessons where slug = 'haishi-vs-huozhe' on conflict do nothing;

-- medios-de-transporte
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('走路',1),('开车',2),('坐',3),('地铁',4),('飞机',5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'medios-de-transporte' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Verbos de transporte', 'Para decir cómo te trasladas de un lugar a otro, el chino usa verbos específicos según el medio de transporte, no una sola palabra genérica como "ir en". 走路 (zǒulù, literalmente "caminar-camino") es ir a pie: 我走路去学校 ("voy a la escuela caminando"). 开车 (kāichē, literalmente "abrir-coche") es conducir tú mismo: 我开车去 ("voy manejando"). Para los demás medios de transporte donde tú NO conduces — autobús, metro, avión, tren — se usa 坐 (zuò), que literalmente significa "sentarse", antes del vehículo: 坐车 ("tomar un coche/autobús"), 坐地铁 ("tomar el metro"), 坐飞机 ("tomar un avión"). La estructura completa suele ser 坐 + vehículo + 去 + destino: 我坐地铁去学校 ("voy a la escuela en metro"). [[AVANZADO]]骑, que ya conoces de 骑马 ("montar a caballo"), también se usa para vehículos de dos ruedas donde te sientas A HORCAJADAS y pedaleas o manejas con el cuerpo — 骑车 ("andar en bicicleta") usa 骑, no 坐, porque la postura física es distinta a sentarse dentro de un vehículo.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'medios-de-transporte' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我走路去学校。', 'Wǒ zǒulù qù xuéxiào.', 'Voy a la escuela caminando.', 1),
  ('我开车去。', 'Wǒ kāichē qù.', 'Voy manejando.', 2),
  ('我坐地铁去学校。', 'Wǒ zuò dìtiě qù xuéxiào.', 'Voy a la escuela en metro.', 3),
  ('你坐飞机去中国吗？', 'Nǐ zuò fēijī qù Zhōngguó ma?', '¿Vas a China en avión?', 4),
  ('他不开车，他走路。', 'Tā bù kāichē, tā zǒulù.', 'Él no maneja, va caminando.', 5),
  ('我们坐车去朋友家。', 'Wǒmen zuò chē qù péngyou jiā.', 'Vamos a casa de nuestro amigo en coche.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'medios-de-transporte' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué verbo se usa para "ir a pie"?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '走路'),
    'options', jsonb_build_array('走路', '开车', '坐'), 'correct_option', '走路'),
  1, true from public.mandarin_lessons where slug = 'medios-de-transporte' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Voy a la escuela en metro."',
  jsonb_build_object('tokens', jsonb_build_array('我', '坐', '地铁', '去', '学校'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true from public.mandarin_lessons where slug = 'medios-de-transporte' on conflict do nothing;
