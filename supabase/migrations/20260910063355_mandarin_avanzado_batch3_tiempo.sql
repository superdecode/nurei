-- ============================================
-- MANDARIN: "Temas avanzados", batch 3 of 5 (order_index 16-20).
-- Comparisons with 比, and time-related vocabulary: telling time,
-- days of the week, months/dates, weather. DEMO ONLY, pending review
-- by Elian. Original writing — HanziBox's free course topic order
-- used as reference only.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('comparacion-bi', 'Comparaciones con 比 (bǐ)', 'Comparar dos cosas usando la estructura A 比 B + adjetivo.', 16),
  ('decir-la-hora', 'Decir la hora: 点 (diǎn) / 分 (fēn) / 小时 (xiǎoshí)', 'Preguntar y decir la hora en chino.', 17),
  ('dias-de-la-semana', 'Los días de la semana: 星期 (xīngqī)', 'Nombrar los días de la semana y preguntar qué día es hoy.', 18),
  ('meses-y-fechas', 'Meses y fechas: 月 (yuè) / 号 (hào) / 日 (rì)', 'Decir meses y fechas completas.', 19),
  ('el-clima', 'El clima: 天气 (tiānqì)', 'Describir el clima con vocabulario básico del tiempo atmosférico.', 20)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basico-avanzado' and u.slug = 'temas-avanzados'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('比', 'bǐ', 'comparado con / que (en comparaciones)'),
  ('点', 'diǎn', 'en punto (para la hora)'),
  ('分', 'fēn', 'minuto'),
  ('小时', 'xiǎoshí', 'hora (duración)'),
  ('半', 'bàn', 'media / mitad'),
  ('几', 'jǐ', 'cuántos (para números pequeños)'),
  ('星期', 'xīngqī', 'semana'),
  ('星期一', 'xīngqīyī', 'lunes'),
  ('星期二', 'xīngqīèr', 'martes'),
  ('星期三', 'xīngqīsān', 'miércoles'),
  ('星期四', 'xīngqīsì', 'jueves'),
  ('星期五', 'xīngqīwǔ', 'viernes'),
  ('星期六', 'xīngqīliù', 'sábado'),
  ('星期日', 'xīngqīrì', 'domingo (formal)'),
  ('星期天', 'xīngqītiān', 'domingo (coloquial)'),
  ('月', 'yuè', 'mes'),
  ('号', 'hào', 'día del mes (coloquial)'),
  ('年', 'nián', 'año'),
  ('零', 'líng', 'cero'),
  ('天气', 'tiānqì', 'clima / tiempo atmosférico'),
  ('冷', 'lěng', 'frío'),
  ('热', 'rè', 'caliente / caluroso'),
  ('下雨', 'xiàyǔ', 'llover'),
  ('晴天', 'qíngtiān', 'día soleado'),
  ('怎么样', 'zěnmeyàng', '¿cómo es/está? (pregunta general)')
on conflict do nothing;

-- comparacion-bi
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 1 from public.mandarin_lessons les join public.mandarin_vocab_items v2 on v2.hanzi = '比'
where les.slug = 'comparacion-bi' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '比 para comparar dos cosas', '比 (bǐ) se usa para comparar dos cosas, con la estructura A + 比 + B + adjetivo: "A es más [adjetivo] que B". 我比你高 ("soy más alto que tú") — aquí el adjetivo (高) va SOLO, sin 很 delante, a diferencia de las frases normales con adjetivos donde 很 es casi obligatorio (como viste en la lección de los adjetivos): 我比你很高 suena incorrecto. Para negar una comparación, se usa 没有 en vez de 不比: 我没有你高 ("no soy tan alto como tú", literalmente "no tengo [la altura] de ti") es mucho más natural que 我不比你高. Para especificar por cuánto, se añade una cantidad después del adjetivo: 我比你高一点儿 ("soy un poco más alto que tú"). [[AVANZADO]]不比 sí existe, pero tiene un matiz distinto al de 没有: 我不比你高 suena más como "no es que yo sea más alto que tú" (corrigiendo una suposición), no simplemente "soy menos alto" — por eso 没有 es la forma recomendada para negar comparaciones mientras aprendes.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'comparacion-bi' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('我比你高。', 'Wǒ bǐ nǐ gāo.', 'Soy más alto que tú.', 1),
  ('我没有你高。', 'Wǒ méiyǒu nǐ gāo.', 'No soy tan alto como tú.', 2),
  ('这本书比那本书好。', 'Zhè běn shū bǐ nà běn shū hǎo.', 'Este libro es mejor que ese.', 3),
  ('我比你高一点儿。', 'Wǒ bǐ nǐ gāo yìdiǎnr.', 'Soy un poco más alto que tú.', 4),
  ('我的猫比你的猫大。', 'Wǒ de māo bǐ nǐ de māo dà.', 'Mi gato es más grande que el tuyo.', 5),
  ('你的车比我的车好。', 'Nǐ de chē bǐ wǒ de chē hǎo.', 'Tu coche es mejor que el mío.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'comparacion-bi' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', 'En A比B+adjetivo, ¿qué palabra normalmente NO se usa delante del adjetivo?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '比'),
    'options', jsonb_build_array('很', '一点儿', '比'), 'correct_option', '很'),
  1, true from public.mandarin_lessons where slug = 'comparacion-bi' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Soy más alto que tú."',
  jsonb_build_object('tokens', jsonb_build_array('我', '比', '你', '高'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'comparacion-bi' on conflict do nothing;

-- decir-la-hora
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('点', 1), ('分', 2), ('小时', 3), ('半', 4), ('几', 5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'decir-la-hora' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Cómo decir la hora', 'Para decir la hora, se usa 点 (diǎn) después del número: 三点 ("las tres en punto"). Ya sabes que "las dos" usa 两 en vez de 二 delante de un clasificador — 点 funciona igual: "las dos en punto" es 两点, nunca 二点. Para los minutos, se añade 分 (fēn) después de otro número: 三点二十分 ("las tres y veinte"). Para la media hora, en vez de decir "三十分" se suele usar 半 (bàn, "media"): 三点半 ("las tres y media"). Para preguntar la hora, se usa 几点 (jǐ diǎn, "¿qué hora?", literalmente "cuántos puntos"): 现在几点? ("¿qué hora es ahora?"). 小时 (xiǎoshí) es distinto de 点 — 点 marca un punto en el reloj ("las tres"), mientras que 小时 mide una DURACIÓN en horas ("tres horas"): 我们有三个小时 ("tenemos tres horas") — aquí sí se necesita el clasificador 个, porque estás contando horas como cantidad, no señalando un punto del reloj. [[AVANZADO]]小时 y 点 pueden confundirse porque ambos se traducen como "hora" en español — la forma de distinguirlos es preguntarte si hablas de un momento del reloj (点) o de una cantidad de tiempo transcurrido (小时): "son las tres" usa 点, "durante tres horas" usa 小时.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'decir-la-hora' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('现在几点？', 'Xiànzài jǐ diǎn?', '¿Qué hora es ahora?', 1),
  ('现在三点。', 'Xiànzài sān diǎn.', 'Ahora son las tres.', 2),
  ('现在两点半。', 'Xiànzài liǎng diǎn bàn.', 'Ahora son las dos y media.', 3),
  ('现在三点二十分。', 'Xiànzài sān diǎn èrshí fēn.', 'Ahora son las tres y veinte.', 4),
  ('我们有三个小时。', 'Wǒmen yǒu sān gè xiǎoshí.', 'Tenemos tres horas.', 5),
  ('我七点吃米饭。', 'Wǒ qī diǎn chī mǐfàn.', 'Como arroz a las siete.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'decir-la-hora' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cómo se dice "las dos en punto"?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '点'),
    'options', jsonb_build_array('两点', '二点', '两个点'), 'correct_option', '两点'),
  1, true from public.mandarin_lessons where slug = 'decir-la-hora' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "¿Qué hora es ahora?"',
  jsonb_build_object('tokens', jsonb_build_array('现在', '几', '点'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true from public.mandarin_lessons where slug = 'decir-la-hora' on conflict do nothing;

-- dias-de-la-semana
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('星期', 1), ('星期一', 2), ('星期二', 3), ('星期三', 4), ('星期四', 5), ('星期五', 6), ('星期六', 7), ('星期日', 8), ('星期天', 9)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'dias-de-la-semana' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Los días de la semana', 'Los días de la semana en chino son extremadamente regulares: 星期 (xīngqī, "semana") más un número del uno al seis para lunes a sábado — 星期一 (lunes, literalmente "semana-uno"), 星期二 (martes), 星期三 (miércoles), 星期四 (jueves), 星期五 (viernes), 星期六 (sábado). El domingo es la única excepción: no es "星期七", sino 星期日 (xīngqīrì) o, más común en el habla cotidiana, 星期天 (xīngqītiān) — ambos significan literalmente "día de la semana". Para preguntar qué día es hoy, se usa 星期几 (xīngqī jǐ, "¿qué día de la semana?", con el mismo 几 que aprendiste para preguntar la hora): 今天星期几? ("¿qué día es hoy?"). [[AVANZADO]]Como 今天 ya funciona como sustantivo de tiempo, la frase 今天星期几 no necesita el verbo 是 — pero añadir 是 (今天是星期几) también es correcto y común, así que puedes usar cualquiera de las dos formas indistintamente.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'dias-de-la-semana' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('今天星期几？', 'Jīntiān xīngqī jǐ?', '¿Qué día es hoy?', 1),
  ('今天星期一。', 'Jīntiān xīngqīyī.', 'Hoy es lunes.', 2),
  ('星期六我不去学校。', 'Xīngqīliù wǒ bú qù xuéxiào.', 'El sábado no voy a la escuela.', 3),
  ('星期天我在家。', 'Xīngqītiān wǒ zài jiā.', 'El domingo estoy en casa.', 4),
  ('我星期五能去。', 'Wǒ xīngqīwǔ néng qù.', 'Puedo ir el viernes.', 5),
  ('今天是星期三。', 'Jīntiān shì xīngqīsān.', 'Hoy es miércoles.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'dias-de-la-semana' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cómo se dice "domingo"?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '星期天'),
    'options', jsonb_build_array('星期日 / 星期天', '星期七', '星期日一'), 'correct_option', '星期日 / 星期天'),
  1, true from public.mandarin_lessons where slug = 'dias-de-la-semana' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "¿Qué día es hoy?"',
  jsonb_build_object('tokens', jsonb_build_array('今天', '星期', '几'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true from public.mandarin_lessons where slug = 'dias-de-la-semana' on conflict do nothing;

-- meses-y-fechas
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('月', 1), ('号', 2), ('日', 3), ('年', 4), ('零', 5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'meses-y-fechas' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Meses y fechas', 'Los meses en chino son igual de regulares que los números: se antepone el número del mes a 月 (yuè, "mes") — 一月 (enero, "mes uno"), 二月 (febrero), y así hasta 十二月 (diciembre). Para el día del mes, se usa un número seguido de 号 (hào) en el habla coloquial, o 日 (rì) en contextos más formales o escritos — ambos significan lo mismo, "día [del mes]": 三号 y 三日 dicen exactamente lo mismo ("el día tres"), pero 号 es lo que más vas a escuchar en conversación. Una fecha completa sigue el orden mes + día, al revés que en español: 三月五号 es "5 de marzo" (literalmente "mes tres, día cinco"), nunca en el orden inverso. Si también quieres decir el año, va primero: 二零二五年三月五号 ("5 de marzo de 2025") — 年 (nián, "año") se lee dígito por dígito, no como un número completo (二零二五 se lee "dos-cero-dos-cinco", no "dos mil veinticinco"). [[AVANZADO]]年 es nuevo aquí y solo lo necesitas para fechas completas con año — no hace falta memorizarlo a fondo todavía, con reconocerlo cuando aparece es suficiente por ahora.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'meses-y-fechas' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('三月五号。', 'Sān yuè wǔ hào.', '5 de marzo.', 1),
  ('今天几月几号？', 'Jīntiān jǐ yuè jǐ hào?', '¿Qué fecha es hoy?', 2),
  ('我一月去中国。', 'Wǒ yī yuè qù Zhōngguó.', 'Voy a China en enero.', 3),
  ('今天是十二月十号。', 'Jīntiān shì shí’èr yuè shí hào.', 'Hoy es 10 de diciembre.', 4),
  ('我的朋友八月来。', 'Wǒ de péngyou bā yuè lái.', 'Mi amigo viene en agosto.', 5),
  ('二零二五年三月五号。', 'Èr líng èr wǔ nián sān yuè wǔ hào.', '5 de marzo de 2025.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'meses-y-fechas' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cuál es el orden correcto de una fecha en chino?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '月'),
    'options', jsonb_build_array('mes + día', 'día + mes', 'día + mes + año'), 'correct_option', 'mes + día'),
  1, true from public.mandarin_lessons where slug = 'meses-y-fechas' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "5 de marzo."',
  jsonb_build_object('tokens', jsonb_build_array('三', '月', '五', '号'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'meses-y-fechas' on conflict do nothing;

-- el-clima
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('天气', 1), ('冷', 2), ('热', 3), ('下雨', 4), ('晴天', 5), ('怎么样', 6)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'el-clima' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Hablar del clima', '天气 (tiānqì, "clima") se usa con adjetivos igual que cualquier otro sustantivo + adjetivo chino: 天气很冷 ("hace frío", literalmente "el clima está muy frío"), 天气很热 ("hace calor"). Con 越来越 que ya aprendiste, puedes decir que el clima cambia progresivamente: 天气越来越冷了 ("hace cada vez más frío"). 下雨 (xiàyǔ, "llover") es un verbo especial — literalmente significa "bajar lluvia", y funciona como un verbo normal en la frase: 今天下雨 ("hoy llueve"), 明天不下雨 ("mañana no llueve"). Para preguntar cómo está el clima, se usa 天气怎么样 (tiānqì zěnmeyàng, "¿cómo está el clima?") — 怎么样 (zěnmeyàng) es una pregunta general de "¿cómo es/está?" que también funciona para preguntar por cualquier otra cosa, no solo el clima. [[AVANZADO]]怎么样 es una palabra muy versátil que verás usada en muchos otros contextos más adelante (para preguntar la opinión de alguien, por ejemplo) — por ahora, basta con reconocerla en la pregunta sobre el clima.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'el-clima' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('今天天气很冷。', 'Jīntiān tiānqì hěn lěng.', 'Hoy hace frío.', 1),
  ('今天天气很热。', 'Jīntiān tiānqì hěn rè.', 'Hoy hace calor.', 2),
  ('今天下雨。', 'Jīntiān xiàyǔ.', 'Hoy llueve.', 3),
  ('明天不下雨。', 'Míngtiān bú xiàyǔ.', 'Mañana no llueve.', 4),
  ('天气越来越冷了。', 'Tiānqì yuèláiyuè lěng le.', 'Hace cada vez más frío.', 5),
  ('今天天气怎么样？', 'Jīntiān tiānqì zěnmeyàng?', '¿Cómo está el clima hoy?', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'el-clima' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 下雨?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '下雨'),
    'options', jsonb_build_array('llover', 'hacer frío', 'hacer calor'), 'correct_option', 'llover'),
  1, true from public.mandarin_lessons where slug = 'el-clima' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Hoy hace frío."',
  jsonb_build_object('tokens', jsonb_build_array('今天', '天气', '很', '冷'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'el-clima' on conflict do nothing;
