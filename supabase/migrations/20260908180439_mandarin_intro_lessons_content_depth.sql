-- ============================================
-- MANDARIN: content-depth pass for "Introducción al chino" (the
-- course's entry point) — splits each lesson's single explanation
-- into 2 organized parts, adds a 2nd example, 1-2 more exercises,
-- and a per-word usage example for every vocab item these 5 lessons
-- use. DEMO content, original writing — pending review by Elian.
--
-- Note on `on conflict do nothing`: mandarin_grammar_points,
-- mandarin_examples and mandarin_exercises have no unique constraint
-- beyond their primary key, so this clause cannot actually fire and
-- is a no-op — safe only because this migration is written to run
-- exactly once. Consistent with every prior content migration in
-- this project; not fixed here to avoid unrelated schema scope creep.
-- ============================================

-- ---- Part A: split each lesson's existing explanation into 2 parts ----
-- The ORIGINAL single grammar_points row per lesson stays as "part 1"
-- (order_index 1, untouched) and each lesson gets a NEW "part 2" row.

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'La estructura de una sílaba en pinyin', 'Cada sílaba en pinyin se forma con una inicial (opcional) y una final, más el tono. Por ejemplo en 汉 (hàn), "h" es la inicial y "an" es la final. La marca de tono se escribe siempre sobre la vocal principal de la final — si hay varias vocales seguidas, sigue el orden a > e/o > i > u/ü (por eso es hǎo y no haǒ). Un detalle práctico que verás en textos con pinyin: cuando dos sílabas seguidas podrían confundirse (por ejemplo si una termina en vocal y la siguiente empieza con vocal), se usa un apóstrofo para separarlas — como en el nombre de la ciudad Xi''an, que se escribe Xī''ān y no Xian (que se leería como una sola sílaba distinta). También existen dos finales que se confunden fácilmente por escrito pero suenan distinto: -n (como en 汉, hàn) es un sonido nasal corto con la lengua tocando el paladar, mientras que -ng (como en 汤, tāng) es una nasal más larga, con la parte de atrás de la lengua elevada y sin que la punta toque nada — confundirlas es uno de los errores más comunes de quienes recién empiezan.', 2
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Cómo entrenar el oído para los tonos', 'Distinguir tonos de oído es, para la mayoría de hispanohablantes, más difícil que producirlos. Una estrategia útil es practicar con pares mínimos —palabras que solo se diferencian por el tono, como 妈/麻/马/骂— diciéndolas en voz alta de forma exagerada al principio, marcando mucho la subida o bajada de la voz, y suavizando la exageración con la práctica. También es común ver los tonos representados con números en vez de acentos al escribir rápido o en teclados sin diacríticos: ma1 (妈), ma2 (麻), ma3 (马), ma4 (骂) — esta notación numérica significa exactamente lo mismo que los acentos sobre la vocal. Una última idea que ayuda mucho al empezar: los tonos son más fáciles de reconocer dentro de una frase completa que en una sílaba aislada, porque el contexto (qué palabra tendría sentido ahí) hace más fácil adivinar qué tono era, incluso si el oído todavía no lo distingue perfectamente por sí solo.', 2
from public.mandarin_lessons where slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Otras formas de despedirse', 'Más allá de 再见, existe un patrón productivo para despedirse mencionando cuándo volverán a verse: 再 + [momento] + 见. Por ejemplo, 明天见 (míngtiān jiàn) significa "nos vemos mañana", y 一会儿见 (yíhuìr jiàn) significa "nos vemos al rato" — en ambos casos, 见 (jiàn, "ver") cierra la frase igual que en 再见. También es muy común, sobre todo entre gente joven, usar 拜拜 (báibái), un préstamo directo del inglés "bye bye" que se pronuncia de forma parecida y funciona en situaciones informales — pero no es apropiado con superiores, profesores o en contextos formales, donde 再见 sigue siendo la opción segura. Una diferencia cultural útil: en chino no es tan común decir "gracias" entre familiares o amigos muy cercanos por cosas pequeñas — puede sonar hasta distante — mientras que con desconocidos, en el trabajo, o en tiendas, 谢谢 se usa constantemente, igual que en español.', 2
from public.mandarin_lessons where slug = 'hola'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'El verbo 叫 para tu nombre', 'Para decir cómo te llamas, se usa el verbo 叫 (jiào) directamente antes del nombre: 我叫小明 (wǒ jiào Xiǎomíng, "me llamo Xiaoming") — a diferencia del español, no hace falta ningún reflexivo como "me". Para preguntar el nombre de alguien de forma natural, se dice 你叫什么名字? (nǐ jiào shénme míngzi?, "¿cómo te llamas?", literalmente "¿tú te-llamas qué nombre?"). 叫 se usa específicamente para nombres propios; para presentarte por tu profesión o identidad (no tu nombre) usarás 是, que ya conoces: 我是学生 ("soy estudiante") usa 是, pero 我叫小明 ("me llamo Xiaoming") usa 叫 — son dos verbos distintos para dos tipos de presentación distintos.', 2
from public.mandarin_lessons where slug = 'presentarse'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Los pronombres básicos: 我, 你, 他, 她', '我 (wǒ, "yo"), 你 (nǐ, "tú") y 他/她 (tā, "él/ella") son la base de casi cualquier frase en chino. A diferencia del español, el verbo NUNCA cambia según el pronombre — no existe algo como "yo soy" vs. "tú eres"; siempre es la misma forma del verbo (我是, 你是, 他是 usan el mismo 是). Esto significa que en chino, a diferencia del español, casi nunca puedes omitir el pronombre: como el verbo no indica quién es el sujeto, hace falta decirlo explícitamente. 他 y 她 se pronuncian exactamente igual (tā) — la única diferencia es visual, al escribirlos.', 1
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

-- The lesson 'pronombres' had no prior explanation with a matching title to
-- update (only a single row about plural formation), so this migration adds
-- a genuine "part 1" here (order_index 1) — first-time content for this
-- specific lesson's opening explanation, not a rewrite of an existing row.
-- Rename the EXISTING plural-focused row to be explicitly "part 2":
-- Verified: title matches character-for-character against the row inserted
-- by supabase/migrations/20260907211456_mandarin_hsk1_seed.sql.
update public.mandarin_grammar_points
set order_index = 2
where lesson_id = (select id from public.mandarin_lessons where slug = 'pronombres')
  and title = 'Plural de pronombres con 们';

-- ---- Part B: a 2nd example per lesson ----

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我说一点儿汉语。', 'Wǒ shuō yìdiǎnr hànyǔ.', 'Hablo un poco de chino.', 2
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这个字有两个音, 不是一个。', 'Zhège zì yǒu liǎng gè yīn, bú shì yī gè.', 'Este carácter tiene dos sonidos (tonos), no uno.', 2
from public.mandarin_lessons where slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '老师，谢谢，再见！', 'Lǎoshī, xièxiè, zàijiàn!', '¡Profesor, gracias, adiós!', 2
from public.mandarin_lessons where slug = 'hola'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你叫什么名字？', 'Nǐ jiào shénme míngzi?', '¿Cómo te llamas?', 2
from public.mandarin_lessons where slug = 'presentarse'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他们是我的朋友。', 'Tāmen shì wǒ de péngyou.', 'Ellos son mis amigos.', 2
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('什么', 'shénme', 'qué')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 6
from public.mandarin_lessons les
join public.mandarin_vocab_items v2 on v2.hanzi = '什么' and v2.pinyin = 'shénme'
where les.slug = 'presentarse'
on conflict do nothing;

-- ---- Part C: 1-2 more exercises per lesson (existing lessons each had 2; adding 1-2 more) ----

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué sonido NO existe en español y aparece en 汉语?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '汉语'),
    'options', jsonb_build_array('ü', 'a', 'o'), 'correct_option', 'ü'),
  3, true
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Hablo un poco de chino."',
  jsonb_build_object('tokens', jsonb_build_array('我', '说', '一点儿', '汉语'), 'correct_order', jsonb_build_array(0,1,2,3)),
  4, true
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cuántos tonos principales tiene el mandarín (sin contar el neutro)?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '妈'),
    'options', jsonb_build_array('4', '3', '5'), 'correct_option', '4'),
  3, true
from public.mandarin_lessons where slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase para decir que la pierna se te entumió: "Se me entumió la pierna."',
  jsonb_build_object('tokens', jsonb_build_array('我', '的', '腿', '有点儿', '麻'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  4, true
from public.mandarin_lessons where slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('腿', 'tuǐ', 'pierna')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 6
from public.mandarin_lessons les
join public.mandarin_vocab_items v2 on v2.hanzi = '腿' and v2.pinyin = 'tuǐ'
where les.slug = 'tonos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué dirías al despedirte de tu profesor?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '再见'),
    'options', jsonb_build_array('再见', '你好', '谢谢'), 'correct_option', '再见'),
  3, true
from public.mandarin_lessons where slug = 'hola'
on conflict do nothing;

-- Sentence-order tile note: this exercise tokenizes the full-width comma
-- "，" as its own standalone tile, matching the SAME precedent already
-- shipped and live in this codebase (see
-- supabase/migrations/20260907211456_mandarin_hsk1_seed.sql, the "hola"
-- sentence_order exercise with tokens ('你好','，','我','叫','小明')).
-- Kept consistent with that precedent rather than merging the comma into
-- an adjacent word tile.
insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "¡Profesor, gracias, adiós!"',
  jsonb_build_object('tokens', jsonb_build_array('老师', '，', '谢谢', '，', '再见'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  4, true
from public.mandarin_lessons where slug = 'hola'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué verbo se usa para decir tu nombre (no tu identidad)?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '叫'),
    'options', jsonb_build_array('叫', '是', '有'), 'correct_option', '叫'),
  3, true
from public.mandarin_lessons where slug = 'presentarse'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "¿Cómo te llamas?"',
  jsonb_build_object('tokens', jsonb_build_array('你', '叫', '什么', '名字'), 'correct_order', jsonb_build_array(0,1,2,3)),
  4, true
from public.mandarin_lessons where slug = 'presentarse'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cómo se dice "ustedes" en chino?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '们'),
    'options', jsonb_build_array('你们', '你', '们你'), 'correct_option', '你们'),
  3, true
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Ellos son mis amigos."',
  jsonb_build_object('tokens', jsonb_build_array('他们', '是', '我的', '朋友'), 'correct_order', jsonb_build_array(0,1,2,3)),
  4, true
from public.mandarin_lessons where slug = 'pronombres'
on conflict do nothing;

-- ---- Part D: per-word usage example for every vocab item these 5 lessons use ----
-- (21 unique words: 你好 谢谢 汉语 日 吃 说 妈 麻 马 骂 骑 再见 我 叫 名字 是 学生 你 他 她 们)
-- Verified: each of these 21 hanzi has exactly one row in mandarin_vocab_items
-- across all migrations (no duplicate-hanzi/homograph case like 只 among
-- them), so the bare `where hanzi = 'X'` updates below are safe.

update public.mandarin_vocab_items set example_hanzi = '你好，我是学生。', example_pinyin = 'Nǐ hǎo, wǒ shì xuéshēng.', example_es = 'Hola, soy estudiante.' where hanzi = '你好';
update public.mandarin_vocab_items set example_hanzi = '谢谢你。', example_pinyin = 'Xièxiè nǐ.', example_es = 'Gracias a ti.' where hanzi = '谢谢';
update public.mandarin_vocab_items set example_hanzi = '我说汉语。', example_pinyin = 'Wǒ shuō hànyǔ.', example_es = 'Yo hablo chino.' where hanzi = '汉语';
update public.mandarin_vocab_items set example_hanzi = '今天是我的生日。', example_pinyin = 'Jīntiān shì wǒ de shēngrì.', example_es = 'Hoy es mi cumpleaños.' where hanzi = '日';
update public.mandarin_vocab_items set example_hanzi = '你吃了吗？', example_pinyin = 'Nǐ chī le ma?', example_es = '¿Ya comiste?' where hanzi = '吃';
update public.mandarin_vocab_items set example_hanzi = '我们说汉语。', example_pinyin = 'Wǒmen shuō hànyǔ.', example_es = 'Nosotros hablamos chino.' where hanzi = '说';
update public.mandarin_vocab_items set example_hanzi = '妈妈很好。', example_pinyin = 'Māma hěn hǎo.', example_es = 'Mamá está bien.' where hanzi = '妈';
update public.mandarin_vocab_items set example_hanzi = '我的腿有点儿麻。', example_pinyin = 'Wǒ de tuǐ yǒudiǎnr má.', example_es = 'Tengo la pierna un poco entumecida.' where hanzi = '麻';
update public.mandarin_vocab_items set example_hanzi = '我喜欢马。', example_pinyin = 'Wǒ xǐhuan mǎ.', example_es = 'Me gustan los caballos.' where hanzi = '马';
update public.mandarin_vocab_items set example_hanzi = '妈妈骂我了。', example_pinyin = 'Māma mà wǒ le.', example_es = 'Mamá me regañó.' where hanzi = '骂';
update public.mandarin_vocab_items set example_hanzi = '妈妈骑马。', example_pinyin = 'Māma qí mǎ.', example_es = 'Mamá monta a caballo.' where hanzi = '骑';
update public.mandarin_vocab_items set example_hanzi = '老师，再见！', example_pinyin = 'Lǎoshī, zàijiàn!', example_es = '¡Adiós, profesor!' where hanzi = '再见';
update public.mandarin_vocab_items set example_hanzi = '我是学生。', example_pinyin = 'Wǒ shì xuéshēng.', example_es = 'Soy estudiante.' where hanzi = '我';
update public.mandarin_vocab_items set example_hanzi = '我叫小明。', example_pinyin = 'Wǒ jiào Xiǎomíng.', example_es = 'Me llamo Xiaoming.' where hanzi = '叫';
update public.mandarin_vocab_items set example_hanzi = '我的名字是小明。', example_pinyin = 'Wǒ de míngzi shì Xiǎomíng.', example_es = 'Mi nombre es Xiaoming.' where hanzi = '名字';
update public.mandarin_vocab_items set example_hanzi = '他是老师。', example_pinyin = 'Tā shì lǎoshī.', example_es = 'Él es profesor.' where hanzi = '是';
update public.mandarin_vocab_items set example_hanzi = '我们是学生。', example_pinyin = 'Wǒmen shì xuéshēng.', example_es = 'Somos estudiantes.' where hanzi = '学生';
update public.mandarin_vocab_items set example_hanzi = '你是我的朋友。', example_pinyin = 'Nǐ shì wǒ de péngyou.', example_es = 'Tú eres mi amigo.' where hanzi = '你';
update public.mandarin_vocab_items set example_hanzi = '他是我爸爸。', example_pinyin = 'Tā shì wǒ bàba.', example_es = 'Él es mi papá.' where hanzi = '他';
update public.mandarin_vocab_items set example_hanzi = '她是我妈妈。', example_pinyin = 'Tā shì wǒ māma.', example_es = 'Ella es mi mamá.' where hanzi = '她';
update public.mandarin_vocab_items set example_hanzi = '你们是朋友吗？', example_pinyin = 'Nǐmen shì péngyou ma?', example_es = '¿Ustedes son amigos?' where hanzi = '们';
