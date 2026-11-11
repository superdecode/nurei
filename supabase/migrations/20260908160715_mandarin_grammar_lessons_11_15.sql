-- ============================================
-- MANDARIN: Gramática — Básico, lessons 11-15.
-- DEMO ONLY, pending review by Elian. Original writing —
-- HanziBox's free course topic order used as reference only.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('verbo-shi', 'Ser o no ser: el verbo 是', 'Usar 是 para identificar y clasificar, y saber cuándo NO usarlo.', 11),
  ('demostrativos', 'Los demostrativos', 'Usar 这 y 那 para señalar "esto" y "eso/aquello".', 12),
  ('sufijo-er', 'El sufijo 儿', 'Reconocer la erhuà (儿) del mandarín del norte y su efecto en la pronunciación.', 13),
  ('verbo-zai', 'Estar: el verbo 在', 'Usar 在 para expresar dónde está algo o alguien.', 14),
  ('adjetivos', 'Los adjetivos', 'Usar adjetivos chinos como si fueran verbos, con 很 delante.', 15)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basica' and u.slug = 'fundamentos-gramaticales'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('那', 'nà', 'eso/aquello, ese/aquel'),
  ('这个', 'zhège', 'este/esta (con clasificador)'),
  ('那个', 'nàge', 'ese/aquel (con clasificador)'),
  ('这里', 'zhèlǐ', 'aquí'),
  ('那里', 'nàlǐ', 'allí/allá'),
  ('在', 'zài', 'estar (en un lugar)'),
  ('玩', 'wán', 'jugar/divertirse'),
  ('家', 'jiā', 'casa/hogar'),
  ('哪儿', 'nǎr', 'dónde (coloquial, con erhuà)'),
  ('漂亮', 'piàoliang', 'bonito/a'),
  ('大', 'dà', 'grande'),
  ('小', 'xiǎo', 'pequeño/a'),
  ('高', 'gāo', 'alto/a'),
  ('很', 'hěn', 'muy (obligatorio ante adjetivo, aunque no siempre se traduzca)'),
  ('房子', 'fángzi', 'casa (edificio)')
on conflict do nothing;

-- Lesson 11: 是
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('是', 1), ('不', 2), ('学生', 3), ('老师', 4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'verbo-shi'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '是 para identificar y clasificar', '是 (shì) conecta dos sustantivos para decir que uno ES el otro, con la estructura A + 是 + B: 我是学生 ("yo soy estudiante"). Se niega con 不是 (nunca 没是), y las preguntas de sí/no se forman añadiendo 吗 al final (你是学生吗?) o repitiendo el verbo en forma afirmativa-negativa: 你是不是学生? (ambas formas son igual de correctas y comunes). El error más frecuente de quien empieza a estudiar chino es usar 是 con adjetivos: en español decimos "el gato ES negro", pero en chino los adjetivos funcionan como verbos y NO llevan 是 — se dice 猫很黑 (el gato es negro), nunca 猫是黑. 是 se reserva exclusivamente para conectar dos sustantivos o frases nominales, nunca un sustantivo con un adjetivo.', 1
from public.mandarin_lessons where slug = 'verbo-shi'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你是老师，不是学生。', 'Nǐ shì lǎoshī, bú shì xuéshēng.', 'Eres profesor, no estudiante.', 1
from public.mandarin_lessons where slug = 'verbo-shi'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cómo se niega 是?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '不'),
    'options', jsonb_build_array('不是', '没是', '不有'), 'correct_option', '不是'),
  1, true
from public.mandarin_lessons where slug = 'verbo-shi'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Eres profesor, no estudiante."',
  jsonb_build_object('tokens', jsonb_build_array('你', '是', '老师', '不是', '学生'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true
from public.mandarin_lessons where slug = 'verbo-shi'
on conflict do nothing;

-- Lesson 12: demostrativos
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('这', 1), ('那', 2), ('这个', 3), ('那个', 4), ('这里', 5), ('那里', 6)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'demostrativos'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '这 y 那: cerca y lejos', '这 (zhè, "esto/este") señala algo cerca de quien habla; 那 (nà, "eso/aquello, ese/aquel") señala algo más lejos — el chino no distingue entre "eso" (cerca del oyente) y "aquello" (lejos de ambos) como sí hace el español con tres niveles; solo hay dos. Con un sustantivo y un clasificador, se dice 这个人 ("esta persona") o 那个人 ("esa persona") — igual que con los números, un demostrativo necesita un clasificador antes del sustantivo, no puede ir pegado directamente salvo con los lugares 这里/那里 ("aquí"/"allí"), que no llevan clasificador porque ya son sustantivos de lugar completos en sí mismos. 个 vuelve a aparecer aquí como el clasificador comodín cuando no se sabe cuál corresponde. En el habla coloquial del norte de China, 这 y 那 a veces se pronuncian zhèi y nèi delante de un clasificador.', 1
from public.mandarin_lessons where slug = 'demostrativos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这个是我的书，那个是你的。', 'Zhège shì wǒ de shū, nàge shì nǐ de.', 'Este es mi libro, ese es el tuyo.', 1
from public.mandarin_lessons where slug = 'demostrativos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 那里?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '那里'),
    'options', jsonb_build_array('allí', 'aquí', 'ese'), 'correct_option', 'allí'),
  1, true
from public.mandarin_lessons where slug = 'demostrativos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Este es mi libro."',
  jsonb_build_object('tokens', jsonb_build_array('这个', '是', '我的', '书'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'demostrativos'
on conflict do nothing;

-- Lesson 13: sufijo 儿 (erhuà)
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('一点儿', 1), ('那里', 2), ('哪儿', 3), ('玩', 4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'sufijo-er'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'La erhuà: el sufijo 儿', '儿 (ér) es un sufijo que se pega al final de algunas palabras y produce un sonido retroflejo ("r" arrastrada) característico del mandarín de Pekín y del norte de China — este fenómeno se llama erhuà (儿化). Ya lo viste sin darte cuenta en 一点儿 (yìdiǎnr, "un poco"). La misma idea de lugar puede decirse de dos formas: 那儿 (nàr, "allí", coloquial/Pekín) o 那里 (nàlǐ, "allí", estándar y usado en todo el país); ambas son correctas, pero 那儿/哪儿 suenan más informales y regionales, mientras que 那里/哪里 son universales. La erhuà NO es obligatoria en el chino estándar (普通话) que se enseña fuera de Pekín, y en el sur de China y en Taiwán casi no se usa — por eso muchos cursos la mencionan pero no insisten en practicarla activamente. Es más un rasgo de acento regional que una regla gramatical estricta.', 1
from public.mandarin_lessons where slug = 'sufijo-er'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你想去哪儿玩？', 'Nǐ xiǎng qù nǎr wán?', '¿A dónde quieres ir a divertirte?', 1
from public.mandarin_lessons where slug = 'sufijo-er'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué palabra ya usaste antes con erhuà, sin darte cuenta?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '一点儿'),
    'options', jsonb_build_array('一点儿', '很多', '一些'), 'correct_option', '一点儿'),
  1, true
from public.mandarin_lessons where slug = 'sufijo-er'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "¿A dónde quieres ir a divertirte?"',
  jsonb_build_object('tokens', jsonb_build_array('你', '想', '去', '哪儿', '玩'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true
from public.mandarin_lessons where slug = 'sufijo-er'
on conflict do nothing;

-- Lesson 14: 在
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('在', 1), ('家', 2), ('学校', 3), ('这里', 4), ('那里', 5)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'verbo-zai'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '在 para decir dónde está algo', '在 (zài) se usa con la estructura Sujeto + 在 + Lugar para decir dónde está alguien o algo: 我在家 (wǒ zài jiā, "estoy en casa"). Es fácil confundirlo con otros dos verbos que ya conoces: 是 identifica QUÉ es algo (我是学生), 有 indica que algo EXISTE o se TIENE (我有书), y 在 indica DÓNDE está algo — los tres son verbos distintos y no se pueden intercambiar. 在 también se usa antes de un verbo para indicar una acción en curso ("estoy [haciendo algo] ahora mismo"), como 我在吃饭 ("estoy comiendo") — este segundo uso, llamado aspecto progresivo, es un tema más avanzado que no cubrimos en detalle aquí. Por ahora, concéntrate en el uso de 在 como "estar en un lugar".', 1
from public.mandarin_lessons where slug = 'verbo-zai'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我们在学校。', 'Wǒmen zài xuéxiào.', 'Estamos en la escuela.', 1
from public.mandarin_lessons where slug = 'verbo-zai'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué verbo se usa para decir DÓNDE está algo?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '在'),
    'options', jsonb_build_array('在', '是', '有'), 'correct_option', '在'),
  1, true
from public.mandarin_lessons where slug = 'verbo-zai'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Estamos en la escuela."',
  jsonb_build_object('tokens', jsonb_build_array('我们', '在', '学校'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'verbo-zai'
on conflict do nothing;

-- Lesson 15: adjetivos
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('很', 1), ('漂亮', 2), ('大', 3), ('小', 4), ('高', 5), ('房子', 6)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'adjetivos'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Los adjetivos funcionan como verbos', 'En chino, los adjetivos actúan como una especie de verbo (llamados "verbos estativos" en gramática): no necesitan 是 para conectarse con el sujeto. Se dice 她很漂亮 ("ella es bonita"), nunca 她是漂亮. El 很 (hěn, "muy") que casi siempre acompaña a un adjetivo en frases afirmativas no siempre se traduce como "muy" — es casi un requisito gramatical para que la frase suene natural y completa, más que una palabra de énfasis. Si quieres énfasis real en "muy", se usa 非常 (fēicháng, "sumamente") o se alarga la pronunciación de 很. Para negar, simplemente se usa 不 antes del adjetivo: 不大 ("no es grande"), sin necesidad de 很 ni de 是. Un adjetivo chino puede además funcionar directamente antes de un sustantivo, igual que en español: 大房子 ("casa grande"), sin partícula extra.', 1
from public.mandarin_lessons where slug = 'adjetivos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这个房子很大。', 'Zhège fángzi hěn dà.', 'Esta casa es grande.', 1
from public.mandarin_lessons where slug = 'adjetivos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué palabra casi siempre acompaña a un adjetivo chino en frases afirmativas?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '很'),
    'options', jsonb_build_array('很', '是', '的'), 'correct_option', '很'),
  1, true
from public.mandarin_lessons where slug = 'adjetivos'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Esta casa es grande."',
  jsonb_build_object('tokens', jsonb_build_array('这个', '房子', '很', '大'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'adjetivos'
on conflict do nothing;
