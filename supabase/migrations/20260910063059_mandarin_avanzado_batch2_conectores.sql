-- ============================================
-- MANDARIN: "Temas avanzados", batch 2 of 5 (order_index 11-15).
-- Connector/conjunction topics: 因为...所以..., 虽然...但是..., 又 vs 再,
-- 除了...以外..., 越来越. DEMO ONLY, pending review by Elian. Original
-- writing — HanziBox's free course topic order used as reference only.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('yinwei-suoyi', 'Porque... por lo tanto: 因为 (yīnwèi)...所以 (suǒyǐ)', 'Explicar causa y consecuencia conectando dos frases.', 11),
  ('suiran-danshi', 'Aunque... pero: 虽然 (suīrán)...但是 (dànshì)', 'Conectar dos ideas que contrastan.', 12),
  ('you-vs-zai-otra-vez', '又 (yòu) y 再 (zài): decir "otra vez"', 'Diferenciar 又 (pasado) y 再 (futuro) al repetir una acción.', 13),
  ('chule-yiwai', 'Excepto: 除了 (chúle)...以外 (yǐwài)', 'Decir "aparte de" o "excepto".', 14),
  ('yuelaiyue', 'Cada vez más: 越来越 (yuèláiyuè)', 'Decir que algo aumenta o cambia progresivamente.', 15)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basico-avanzado' and u.slug = 'temas-avanzados'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('因为', 'yīnwèi', 'porque'),
  ('所以', 'suǒyǐ', 'por lo tanto / así que'),
  ('为什么', 'wèishénme', 'por qué'),
  ('虽然', 'suīrán', 'aunque'),
  ('但是', 'dànshì', 'pero'),
  ('又', 'yòu', 'otra vez (algo que ya sucedió)'),
  ('再', 'zài', 'otra vez (en el futuro)'),
  ('除了', 'chúle', 'aparte de / excepto'),
  ('以外', 'yǐwài', 'fuera de eso'),
  ('英语', 'yīngyǔ', 'inglés (idioma)'),
  ('越来越', 'yuèláiyuè', 'cada vez más')
on conflict do nothing;

-- yinwei-suoyi
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('因为', 1), ('所以', 2), ('为什么', 3)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'yinwei-suoyi' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '因为...所以... para causa y consecuencia', '因为...所以... es la estructura más común para conectar una causa con su consecuencia, parecida a "porque...por lo tanto..." en español — pero a diferencia del español, en chino es normal (y hasta lo más natural) usar AMBAS palabras en la misma frase: 因为我很喜欢猫，所以我有三只猫 ("porque me gusta mucho el gato, por eso tengo tres gatos"). También es correcto omitir una de las dos si el contexto ya es claro: 我很喜欢猫，所以我有三只猫 (sin 因为) sigue siendo una frase válida. El orden siempre es causa primero, consecuencia después — nunca al revés. [[AVANZADO]]También puedes usar solo 因为 sin 所以 cuando la causa va como respuesta a una pregunta: alguien pregunta 你为什么不去? ("¿por qué no vas?") y tú respondes solo 因为我没有钱 ("porque no tengo dinero"), sin necesidad de añadir 所以 a nada.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'yinwei-suoyi' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('因为我很喜欢猫，所以我有三只猫。', 'Yīnwèi wǒ hěn xǐhuan māo, suǒyǐ wǒ yǒu sān zhī māo.', 'Porque me gusta mucho el gato, por eso tengo tres gatos.', 1),
  ('因为我没有钱，所以我不能去。', 'Yīnwèi wǒ méiyǒu qián, suǒyǐ wǒ bù néng qù.', 'Porque no tengo dinero, no puedo ir.', 2),
  ('因为我喜欢喝茶，所以我家有很多茶。', 'Yīnwèi wǒ xǐhuan hē chá, suǒyǐ wǒ jiā yǒu hěn duō chá.', 'Porque me gusta beber té, en mi casa hay mucho té.', 3),
  ('因为他不会说汉语，所以他不能去中国。', 'Yīnwèi tā bú huì shuō hànyǔ, suǒyǐ tā bù néng qù Zhōngguó.', 'Porque él no sabe hablar chino, no puede ir a China.', 4),
  ('因为你是我的朋友，所以我很喜欢你。', 'Yīnwèi nǐ shì wǒ de péngyou, suǒyǐ wǒ hěn xǐhuan nǐ.', 'Porque eres mi amigo, te quiero mucho.', 5),
  ('你为什么不去？因为我没有钱。', 'Nǐ wèishénme bú qù? Yīnwèi wǒ méiyǒu qián.', '¿Por qué no vas? Porque no tengo dinero.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'yinwei-suoyi' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 所以?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '所以'),
    'options', jsonb_build_array('por lo tanto / así que', 'porque', 'pero'), 'correct_option', 'por lo tanto / así que'),
  1, true from public.mandarin_lessons where slug = 'yinwei-suoyi' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Porque no tengo dinero, no puedo ir."',
  jsonb_build_object('tokens', jsonb_build_array('因为', '我', '没有', '钱', '所以', '我', '不能', '去'), 'correct_order', jsonb_build_array(0,1,2,3,4,5,6,7)),
  2, true from public.mandarin_lessons where slug = 'yinwei-suoyi' on conflict do nothing;

-- suiran-danshi
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('虽然', 1), ('但是', 2)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'suiran-danshi' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '虽然...但是... para contrastar dos ideas', '虽然...但是... conecta dos ideas que contrastan, igual que "aunque...pero..." en español — y al igual que 因为...所以..., en chino es normal usar ambas palabras juntas en la misma frase: 虽然我很喜欢猫，但是我没有猫 ("aunque me gusta mucho el gato, no tengo gato"). El orden también es fijo: primero la idea que parece contradecir, después el contraste real con 但是. Se puede omitir 虽然 si el contexto ya deja claro que hay un contraste, pero 但是 casi nunca se omite — es la palabra que realmente marca el "pero". [[AVANZADO]]虽然 y 但是 tienen variantes con el mismo significado — 可是 (kěshì) y 不过 (búguò) también se traducen como "pero" y pueden reemplazar a 但是 en muchos contextos, con matices de formalidad muy sutiles que no necesitas distinguir todavía.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'suiran-danshi' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('虽然我很喜欢猫，但是我没有猫。', 'Suīrán wǒ hěn xǐhuan māo, dànshì wǒ méiyǒu māo.', 'Aunque me gusta mucho el gato, no tengo gato.', 1),
  ('虽然他很喜欢喝茶，但是他今天喝水。', 'Suīrán tā hěn xǐhuan hē chá, dànshì tā jīntiān hē shuǐ.', 'Aunque le gusta mucho el té, hoy bebe agua.', 2),
  ('虽然我没有钱，但是我可以去。', 'Suīrán wǒ méiyǒu qián, dànshì wǒ kěyǐ qù.', 'Aunque no tengo dinero, puedo ir.', 3),
  ('虽然他不是学生，但是他会说汉语。', 'Suīrán tā bú shì xuéshēng, dànshì tā huì shuō hànyǔ.', 'Aunque él no es estudiante, sabe hablar chino.', 4),
  ('虽然这本书很大，但是很好。', 'Suīrán zhè běn shū hěn dà, dànshì hěn hǎo.', 'Aunque este libro es grande, es muy bueno.', 5),
  ('虽然我们没有很多时间，但是我们能去。', 'Suīrán wǒmen méiyǒu hěn duō shíjiān, dànshì wǒmen néng qù.', 'Aunque no tenemos mucho tiempo, podemos ir.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'suiran-danshi' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué palabra marca el "pero" en 虽然...但是...?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '但是'),
    'options', jsonb_build_array('但是', '虽然', '因为'), 'correct_option', '但是'),
  1, true from public.mandarin_lessons where slug = 'suiran-danshi' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Aunque no tengo dinero, puedo ir."',
  jsonb_build_object('tokens', jsonb_build_array('虽然', '我', '没有', '钱', '但是', '我', '可以', '去'), 'correct_order', jsonb_build_array(0,1,2,3,4,5,6,7)),
  2, true from public.mandarin_lessons where slug = 'suiran-danshi' on conflict do nothing;

-- you-vs-zai-otra-vez
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('又', 1), ('再', 2)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'you-vs-zai-otra-vez' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '又 para el pasado, 再 para el futuro', 'Tanto 又 (yòu) como 再 (zài) se traducen como "otra vez" o "de nuevo", pero se usan en momentos distintos: 又 se usa para una acción que YA SE REPITIÓ, algo que ya pasó de nuevo — 他又来了 ("él vino otra vez", ya volvió). 再 se usa para una acción que se repetirá EN EL FUTURO, algo que todavía no ha pasado — 我们再去 ("iremos otra vez"). La regla rápida para recordarlo: 又 mira hacia atrás (pasado), 再 mira hacia adelante (futuro). Ambos se colocan justo antes del verbo, igual que 也 y 还 que ya conoces. [[AVANZADO]]Existe un caso que puede parecer una excepción: cuando 再 aparece junto con 不 para decir "nunca más" (不再, "ya no más" — 我不再喝茶了, "ya no bebo más té"), técnicamente sigue hablando del futuro, así que la regla se mantiene: no es una excepción real, solo puede sentirse confuso al principio.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'you-vs-zai-otra-vez' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('他又来了。', 'Tā yòu lái le.', 'Él vino otra vez.', 1),
  ('我们再去。', 'Wǒmen zài qù.', 'Iremos otra vez.', 2),
  ('我又看了那本书。', 'Wǒ yòu kàn le nà běn shū.', 'Volví a leer ese libro.', 3),
  ('你可以再说吗？', 'Nǐ kěyǐ zài shuō ma?', '¿Puedes decirlo otra vez?', 4),
  ('他又吃了米饭。', 'Tā yòu chī le mǐfàn.', 'Él comió arroz otra vez.', 5),
  ('我不再喝茶了。', 'Wǒ bú zài hē chá le.', 'Ya no bebo más té.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'you-vs-zai-otra-vez' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cuál se usa para una acción que se repetirá en el futuro?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '再'),
    'options', jsonb_build_array('再', '又', '了'), 'correct_option', '再'),
  1, true from public.mandarin_lessons where slug = 'you-vs-zai-otra-vez' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Él vino otra vez."',
  jsonb_build_object('tokens', jsonb_build_array('他', '又', '来', '了'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true from public.mandarin_lessons where slug = 'you-vs-zai-otra-vez' on conflict do nothing;

-- chule-yiwai
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord from public.mandarin_lessons les
join (values ('除了', 1), ('以外', 2), ('英语', 3)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'chule-yiwai' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '除了...以外... para decir "aparte de"', '除了...以外... significa "aparte de" o "excepto", y puede sonar como una exclusión total o como un "además de", según el contexto. Combinado con 都 (dōu, "todos"), significa exclusión total: 除了猫以外，我什么都喜欢 ("aparte del gato, me gusta todo" — el gato es la excepción). Sin esa idea de "todo lo demás", suena más como "además de": 除了汉语以外，我还会说一点儿英语 — aquí no dice que hable todo menos chino, sino que además del chino, también sabe un poco de inglés. 以外 puede omitirse en la conversación informal, dejando solo 除了, pero usar ambas palabras es más claro mientras aprendes. [[AVANZADO]]都 (dōu, "todos/ambos"), la palabra que refuerza el sentido de exclusión total junto a 除了, no se ha enseñado formalmente todavía en este curso — por ahora basta con reconocer las dos formas de usar 除了...以外... que se muestran aquí, sin memorizar 都 todavía.[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'chule-yiwai' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('除了猫以外，我什么都喜欢。', 'Chúle māo yǐwài, wǒ shénme dōu xǐhuan.', 'Aparte del gato, me gusta todo.', 1),
  ('除了汉语以外，我还会说一点儿英语。', 'Chúle hànyǔ yǐwài, wǒ hái huì shuō yìdiǎnr yīngyǔ.', 'Además del chino, también sé hablar un poco de inglés.', 2),
  ('除了我以外，他们都是学生。', 'Chúle wǒ yǐwài, tāmen dōu shì xuéshēng.', 'Aparte de mí, todos ellos son estudiantes.', 3),
  ('除了茶以外，我也喜欢喝水。', 'Chúle chá yǐwài, wǒ yě xǐhuan hē shuǐ.', 'Aparte del té, también me gusta beber agua.', 4),
  ('除了这本书以外，我没有书。', 'Chúle zhè běn shū yǐwài, wǒ méiyǒu shū.', 'Aparte de este libro, no tengo libros.', 5),
  ('除了狗以外，他还有猫。', 'Chúle gǒu yǐwài, tā hái yǒu māo.', 'Aparte del perro, también tiene gato.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'chule-yiwai' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 除了...以外...?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '除了'),
    'options', jsonb_build_array('aparte de / excepto', 'porque', 'aunque'), 'correct_option', 'aparte de / excepto'),
  1, true from public.mandarin_lessons where slug = 'chule-yiwai' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Aparte de mí, todos ellos son estudiantes."',
  jsonb_build_object('tokens', jsonb_build_array('除了', '我', '以外', '他们', '都', '是', '学生'), 'correct_order', jsonb_build_array(0,1,2,3,4,5,6)),
  2, true from public.mandarin_lessons where slug = 'chule-yiwai' on conflict do nothing;

-- yuelaiyue
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 1 from public.mandarin_lessons les join public.mandarin_vocab_items v2 on v2.hanzi = '越来越'
where les.slug = 'yuelaiyue' on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '越来越 para un cambio progresivo', '越来越 (yuèláiyuè) se coloca justo antes de un adjetivo (o de un verbo como 喜欢) para decir que algo se vuelve "cada vez más" así, un cambio progresivo con el tiempo: 你的汉语越来越好 ("tu chino es cada vez mejor"). A diferencia de otros adjetivos chinos, que normalmente necesitan 很 delante para sonar completos (como viste en la lección de los adjetivos), con 越来越 NUNCA se usa 很 — 越来越 ya cumple esa función por sí solo: 越来越好 ("cada vez mejor"), nunca 越来越很好. La estructura literal es "越 (cuanto más) 来 (viene) 越 (más)", una repetición que en español simplemente se traduce como "cada vez más". [[AVANZADO]]越来越 puede combinarse con una comparación de tiempo explícita para reforzar la idea, como 一天比一天 ("día a día") — pero esa combinación usa la estructura de comparación con 比 que verás en una lección aparte; por ahora, 越来越 + adjetivo es más que suficiente para expresar la idea de "cada vez más".[[/AVANZADO]]', 1
from public.mandarin_lessons where slug = 'yuelaiyue' on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord from public.mandarin_lessons les join (values
  ('你的汉语越来越好。', 'Nǐ de hànyǔ yuèláiyuè hǎo.', 'Tu chino es cada vez mejor.', 1),
  ('我越来越喜欢喝茶。', 'Wǒ yuèláiyuè xǐhuan hē chá.', 'Cada vez me gusta más beber té.', 2),
  ('他的猫越来越大。', 'Tā de māo yuèláiyuè dà.', 'Su gato es cada vez más grande.', 3),
  ('你越来越高了。', 'Nǐ yuèláiyuè gāo le.', 'Estás cada vez más alto.', 4),
  ('我的车越来越好。', 'Wǒ de chē yuèláiyuè hǎo.', 'Mi coche es cada vez mejor.', 5),
  ('这只狗越来越大了。', 'Zhè zhī gǒu yuèláiyuè dà le.', 'Este perro es cada vez más grande.', 6)
) as v(hanzi, pinyin, es, ord) on true where les.slug = 'yuelaiyue' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué palabra NUNCA se usa junto con 越来越?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '越来越'),
    'options', jsonb_build_array('很', '了', '的'), 'correct_option', '很'),
  1, true from public.mandarin_lessons where slug = 'yuelaiyue' on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Tu chino es cada vez mejor."',
  jsonb_build_object('tokens', jsonb_build_array('你', '的', '汉语', '越来越', '好'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true from public.mandarin_lessons where slug = 'yuelaiyue' on conflict do nothing;
