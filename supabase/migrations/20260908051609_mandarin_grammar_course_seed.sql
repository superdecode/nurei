-- ============================================
-- MANDARIN: "Gramática básica" — 10 original lessons.
-- DEMO ONLY, pending review by Elian (is_demo_content defaults to true).
-- Topic ORDER is inspired by HanziBox's free course outline; all text,
-- examples and vocabulary here are written from scratch for this project.
-- ============================================

insert into public.mandarin_levels (course_id, slug, title, order_index, is_published)
select id, 'gramatica-basica', 'Gramática básica', 2, true
from public.mandarin_courses where slug = 'curso-de-mandarin'
on conflict (course_id, slug) do nothing;

insert into public.mandarin_units (level_id, slug, title, order_index, is_published)
select l.id, 'fundamentos-gramaticales', 'Fundamentos gramaticales', 1, true
from public.mandarin_levels l
join public.mandarin_courses c on c.id = l.course_id
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basica'
on conflict (level_id, slug) do nothing;

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('pronombres-personales', 'Los pronombres personales', 'Usar 我, 你, 您, 他/她 y sus plurales con 们.', 1),
  ('sustantivos', 'Los sustantivos', 'Entender que los sustantivos chinos no cambian de género ni número.', 2),
  ('posesion-de', 'Expresar posesión con 的', 'Usar 的 para decir "de quién" es algo.', 3),
  ('verbos', 'Los verbos', 'Entender que los verbos chinos no se conjugan y usar el orden sujeto-verbo-objeto.', 4),
  ('oraciones-negativas', 'Oraciones negativas', 'Diferenciar 不 y 没/没有 para negar.', 5),
  ('numeros-1', 'Los números (1)', 'Contar del uno al diez.', 6),
  ('clasificadores', 'Los clasificadores', 'Usar la palabra de medida correcta entre un número y un sustantivo.', 7),
  ('numero-liang', 'El número 两', 'Saber cuándo usar 两 en vez de 二.', 8),
  ('expresar-cantidad', 'Expresar cantidad', 'Usar 很多, 一些 y 一点儿.', 9),
  ('verbos-yao-xiang', 'Los verbos 要 y 想', 'Diferenciar 要 y 想 para expresar deseo o intención.', 10)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basica' and u.slug = 'fundamentos-gramaticales'
on conflict (unit_id, slug) do nothing;

-- Vocabulary bank (new words only — reuses 我/你/他/她/们/是/学生 etc. from HSK1 via lesson_vocab links below)
insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('您', 'nín', 'usted (formal)'),
  ('书', 'shū', 'libro'),
  ('猫', 'māo', 'gato'),
  ('狗', 'gǒu', 'perro'),
  ('水', 'shuǐ', 'agua'),
  ('朋友', 'péngyou', 'amigo/a'),
  ('爸爸', 'bàba', 'papá'),
  ('妈妈', 'māma', 'mamá'),
  ('这', 'zhè', 'esto/este'),
  ('书包', 'shūbāo', 'mochila'),
  ('吃', 'chī', 'comer'),
  ('喝', 'hē', 'beber'),
  ('看', 'kàn', 'ver/mirar'),
  ('说', 'shuō', 'hablar/decir'),
  ('来', 'lái', 'venir'),
  ('学校', 'xuéxiào', 'escuela'),
  ('不', 'bù', 'no (negación general)'),
  ('没', 'méi', 'no (negación de 有 o pasado)'),
  ('一', 'yī', 'uno'),
  ('二', 'èr', 'dos (para contar/matemáticas)'),
  ('三', 'sān', 'tres'),
  ('四', 'sì', 'cuatro'),
  ('五', 'wǔ', 'cinco'),
  ('六', 'liù', 'seis'),
  ('七', 'qī', 'siete'),
  ('八', 'bā', 'ocho'),
  ('九', 'jiǔ', 'nueve'),
  ('十', 'shí', 'diez'),
  ('加', 'jiā', 'más (sumar)'),
  ('等于', 'děngyú', 'ser igual a'),
  ('个', 'ge', 'clasificador general'),
  ('本', 'běn', 'clasificador para libros'),
  ('只', 'zhī', 'clasificador para animales'),
  ('张', 'zhāng', 'clasificador para hojas/objetos planos'),
  ('两', 'liǎng', 'dos (delante de un clasificador)'),
  ('很多', 'hěn duō', 'mucho/muchos'),
  ('一点儿', 'yìdiǎnr', 'un poco'),
  ('一些', 'yìxiē', 'algunos/unos'),
  ('要', 'yào', 'querer/necesitar (directo, inmediato)'),
  ('想', 'xiǎng', 'querer/pensar en (deseo, más suave)'),
  ('中国', 'Zhōngguó', 'China')
on conflict do nothing;

-- Lesson 1: Pronombres personales
-- '老师' and '吗' must be inserted into the vocab bank BEFORE the
-- lesson_vocab join below references them — same ordering rule as
-- 的/去/有 elsewhere in this file.
insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('老师', 'lǎoshī', 'profesor/a'),
  ('吗', 'ma', 'partícula de pregunta sí/no')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('我', 1), ('你', 2), ('您', 3), ('他', 4), ('她', 5), ('们', 6), ('老师', 7), ('吗', 8)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'pronombres-personales'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Formalidad e igualdad de sonido', 'Los pronombres chinos no cambian por género en el habla: 他 (tā, "él") y 她 (tā, "ella") suenan idénticos, solo se distinguen al escribirlos. 您 (nín) es la forma formal de 你 (tú), usada con desconocidos o personas mayores. El plural se forma agregando 们 (men): 你们 (ustedes), 他们/她们 (ellos/ellas).', 1
from public.mandarin_lessons where slug = 'pronombres-personales'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '您好，您是老师吗？', 'Nín hǎo, nín shì lǎoshī ma?', 'Hola, ¿usted es profesor/a?', 1
from public.mandarin_lessons where slug = 'pronombres-personales'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 您?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '您'),
    'options', jsonb_build_array('usted (formal)', 'ustedes', 'nosotros'), 'correct_option', 'usted (formal)'),
  1, true
from public.mandarin_lessons where slug = 'pronombres-personales'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Ustedes son estudiantes."',
  jsonb_build_object('tokens', jsonb_build_array('你们', '是', '学生'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'pronombres-personales'
on conflict do nothing;

-- Lesson 2: Sustantivos
-- '有' must be inserted into the vocab bank BEFORE the lesson_vocab join
-- below references it — same ordering rule as 的/去 elsewhere in this file.
insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('有', 'yǒu', 'tener/haber')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('书', 1), ('猫', 2), ('狗', 3), ('水', 4), ('朋友', 5), ('有', 6)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'sustantivos'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Sin género ni plural', 'A diferencia del español, los sustantivos chinos nunca cambian de forma: no tienen género gramatical y no se pluralizan añadiendo una letra. 书 (shū) significa tanto "libro" como "libros" — el contexto o un número indican la cantidad. La única excepción es 们 (men), que solo se usa con personas (朋友们 = "amigos"), nunca con objetos o animales.', 1
from public.mandarin_lessons where slug = 'sustantivos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有书。', 'Wǒ yǒu shū.', 'Tengo un libro. / Tengo libros.', 1
from public.mandarin_lessons where slug = 'sustantivos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 朋友?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '朋友'),
    'options', jsonb_build_array('amigo/a', 'profesor/a', 'estudiante'), 'correct_option', 'amigo/a'),
  1, true
from public.mandarin_lessons where slug = 'sustantivos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Tengo un gato."',
  jsonb_build_object('tokens', jsonb_build_array('我', '有', '猫'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'sustantivos'
on conflict do nothing;

-- Lesson 3: Posesión con 的
-- '的' must be inserted into the vocab bank BEFORE the lesson_vocab join
-- below references it — a join that runs before the row exists silently
-- matches nothing (no SQL error, just a missing link), so order matters here.
insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('的', 'de', 'partícula posesiva ("de")')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('的', 1), ('爸爸', 2), ('妈妈', 3), ('这', 4), ('书包', 5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'posesion-de'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Poseedor + 的 + poseído', 'Para decir "de quién" es algo, se coloca 的 (de) entre el poseedor y lo poseído: 我的书 (wǒ de shū) es "mi libro". Con relaciones cercanas (familia, amigos íntimos) el 的 suele omitirse: se dice 我妈妈 ("mi mamá") en vez de 我的妈妈, aunque ambas formas son válidas.', 1
from public.mandarin_lessons where slug = 'posesion-de'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这是我的书包。', 'Zhè shì wǒ de shūbāo.', 'Esta es mi mochila.', 1
from public.mandarin_lessons where slug = 'posesion-de'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 爸爸?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '爸爸'),
    'options', jsonb_build_array('papá', 'mamá', 'amigo'), 'correct_option', 'papá'),
  1, true
from public.mandarin_lessons where slug = 'posesion-de'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Esta es mi mochila."',
  jsonb_build_object('tokens', jsonb_build_array('这', '是', '我的', '书包'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'posesion-de'
on conflict do nothing;

-- Lesson 4: Verbos
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('吃', 1), ('喝', 2), ('看', 3), ('说', 4), ('来', 5), ('学校', 6)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'verbos'
on conflict do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('去', 'qù', 'ir')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 7
from public.mandarin_lessons les
join public.mandarin_vocab_items v2 on v2.hanzi = '去'
where les.slug = 'verbos'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Verbos invariables y orden SVO', 'Los verbos chinos jamás se conjugan: la misma forma sirve para "yo como", "tú comes" o "ellos comieron" — el tiempo se indica con palabras de tiempo o partículas que verás en lecciones futuras, no cambiando el verbo. El orden básico de la oración es Sujeto + Verbo + Objeto, igual que en español: 我们去学校 (Wǒmen qù xuéxiào) = "Nosotros vamos a la escuela".', 1
from public.mandarin_lessons where slug = 'verbos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我们去学校。', 'Wǒmen qù xuéxiào.', 'Vamos a la escuela.', 1
from public.mandarin_lessons where slug = 'verbos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 喝?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '喝'),
    'options', jsonb_build_array('beber', 'comer', 'hablar'), 'correct_option', 'beber'),
  1, true
from public.mandarin_lessons where slug = 'verbos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Yo bebo agua."',
  jsonb_build_object('tokens', jsonb_build_array('我', '喝', '水'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'verbos'
on conflict do nothing;

-- Lesson 5: Oraciones negativas
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('不', 1), ('没', 2), ('是', 3), ('学生', 4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'oraciones-negativas'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '不 versus 没/没有', '不 (bù) niega la mayoría de los verbos y adjetivos en presente o futuro: 我不吃 ("no como"). 没 o 没有 (méi/méiyǒu) se usa para negar 有 (tener/haber) y acciones pasadas ya completadas: 我没有书 ("no tengo libro"), 我没吃 ("no comí"/"no he comido"). Nunca se usa 不有 — siempre es 没有.', 1
from public.mandarin_lessons where slug = 'oraciones-negativas'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我不是学生，我是老师。', 'Wǒ búshì xuéshēng, wǒ shì lǎoshī.', 'No soy estudiante, soy profesor/a.', 1
from public.mandarin_lessons where slug = 'oraciones-negativas'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué partícula se usa para negar 有 (tener)?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '没'),
    'options', jsonb_build_array('没', '不', '吗'), 'correct_option', '没'),
  1, true
from public.mandarin_lessons where slug = 'oraciones-negativas'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "No soy estudiante."',
  jsonb_build_object('tokens', jsonb_build_array('我', '不', '是', '学生'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'oraciones-negativas'
on conflict do nothing;

-- Lesson 6: Números (1)
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('一',1),('二',2),('三',3),('四',4),('五',5),('六',6),('七',7),('八',8),('九',9),('十',10)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'numeros-1'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Contar del 1 al 10', 'Los números del uno al diez son palabras individuales que se memorizan directamente: 一 (1), 二 (2), 三 (3), 四 (4), 五 (5), 六 (6), 七 (7), 八 (8), 九 (9), 十 (10). A partir del 11 se combinan: 十一 (11) es literalmente "diez-uno", 二十 (20) es "dos-diez". El número 二 se usa para contar y en matemáticas; en la lección 8 verás una excepción importante.', 1
from public.mandarin_lessons where slug = 'numeros-1'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '一加一等于二。', 'Yī jiā yī děngyú èr.', 'Uno más uno es igual a dos.', 1
from public.mandarin_lessons where slug = 'numeros-1'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué número es 五?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '五'),
    'options', jsonb_build_array('5', '7', '9'), 'correct_option', '5'),
  1, true
from public.mandarin_lessons where slug = 'numeros-1'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena los caracteres para formar "veintiuno" (21).',
  jsonb_build_object('tokens', jsonb_build_array('二', '十', '一'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'numeros-1'
on conflict do nothing;

-- Lesson 7: Clasificadores
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('个',1),('本',2),('只',3),('张',4),('朋友',5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'clasificadores'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Número + clasificador + sustantivo', 'En chino, un número casi nunca va directo sobre un sustantivo: necesita una palabra de medida (clasificador) en medio. 个 (ge) es el clasificador genérico, útil cuando no sabes cuál usar. 本 (běn) se usa para libros y publicaciones, 只 (zhī) para animales, y 张 (zhāng) para objetos planos como hojas de papel. Ejemplo: 一个人 (una persona), 三只猫 (tres gatos).', 1
from public.mandarin_lessons where slug = 'clasificadores'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有一个朋友。', 'Wǒ yǒu yí gè péngyou.', 'Tengo un amigo.', 1
from public.mandarin_lessons where slug = 'clasificadores'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué clasificador se usa para libros?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '本'),
    'options', jsonb_build_array('本', '只', '张'), 'correct_option', '本'),
  1, true
from public.mandarin_lessons where slug = 'clasificadores'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Tengo tres gatos."',
  jsonb_build_object('tokens', jsonb_build_array('我', '有', '三', '只', '猫'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true
from public.mandarin_lessons where slug = 'clasificadores'
on conflict do nothing;

-- Lesson 8: El número 两
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('两',1),('二',2),('只',3),('狗',4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'numero-liang'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '两 en vez de 二 ante un clasificador', '二 (èr) se usa para contar en secuencia y en matemáticas (二, 十二, 二十), pero cuando se especifica la cantidad "dos" de algo junto a un clasificador, se usa 两 (liǎng) en su lugar: 两个人 (dos personas), nunca 二个人. La excepción es 二十 (20), que sigue usando 二 aunque contenga la idea de "dos dieces".', 1
from public.mandarin_lessons where slug = 'numero-liang'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有两只狗。', 'Wǒ yǒu liǎng zhī gǒu.', 'Tengo dos perros.', 1
from public.mandarin_lessons where slug = 'numero-liang'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cuál se usa ANTES de un clasificador para decir "dos"?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '两'),
    'options', jsonb_build_array('两', '二', '三'), 'correct_option', '两'),
  1, true
from public.mandarin_lessons where slug = 'numero-liang'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Tengo dos perros."',
  jsonb_build_object('tokens', jsonb_build_array('我', '有', '两', '只', '狗'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true
from public.mandarin_lessons where slug = 'numero-liang'
on conflict do nothing;

-- Lesson 9: Expresar cantidad
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('很多',1),('一点儿',2),('一些',3),('朋友',4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'expresar-cantidad'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '很多, 一些 y 一点儿', '很多 (hěn duō, "mucho/muchos") y 一些 (yìxiē, "algunos/unos") van directo antes del sustantivo, sin necesitar un clasificador: 很多朋友 (muchos amigos), 一些书 (algunos libros). 一点儿 (yìdiǎnr, "un poco") se usa típicamente con sustantivos no contables como el agua: 一点儿水 (un poco de agua).', 1
from public.mandarin_lessons where slug = 'expresar-cantidad'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有很多朋友。', 'Wǒ yǒu hěn duō péngyou.', 'Tengo muchos amigos.', 1
from public.mandarin_lessons where slug = 'expresar-cantidad'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 一点儿?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '一点儿'),
    'options', jsonb_build_array('un poco', 'mucho', 'nada'), 'correct_option', 'un poco'),
  1, true
from public.mandarin_lessons where slug = 'expresar-cantidad'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Tengo muchos amigos."',
  jsonb_build_object('tokens', jsonb_build_array('我', '有', '很多', '朋友'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'expresar-cantidad'
on conflict do nothing;

-- Lesson 10: Verbos 要 y 想
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('要',1),('想',2),('去',3),('中国',4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'verbos-yao-xiang'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '要 vs 想: dos formas de "querer"', 'Ambos se traducen como "querer", pero con matices distintos. 要 (yào) es más directo e inmediato — expresa una necesidad o un deseo concreto de hacer algo ahora: 我要喝水 ("quiero/necesito beber agua"). 想 (xiǎng) es más suave y reflexivo, como un deseo o intención general: 我想去中国 ("me gustaría ir a China" / "pienso en ir a China"). Ambos se colocan antes del verbo o sustantivo deseado.', 1
from public.mandarin_lessons where slug = 'verbos-yao-xiang'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我想去中国。', 'Wǒ xiǎng qù Zhōngguó.', 'Me gustaría ir a China.', 1
from public.mandarin_lessons where slug = 'verbos-yao-xiang'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cuál es más directo/inmediato: "quiero agua ahora"?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '要'),
    'options', jsonb_build_array('要', '想', '去'), 'correct_option', '要'),
  1, true
from public.mandarin_lessons where slug = 'verbos-yao-xiang'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Me gustaría ir a China."',
  jsonb_build_object('tokens', jsonb_build_array('我', '想', '去', '中国'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'verbos-yao-xiang'
on conflict do nothing;
