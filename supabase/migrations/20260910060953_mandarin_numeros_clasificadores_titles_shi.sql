-- ============================================
-- MANDARIN: four fixes.
--
-- 1. Lesson titles that show a bare hanzi character now include its
-- pinyin in parentheses, consistent with the "hanzi (pinyin, gloss)"
-- convention already used everywhere else in the course body text.
--
-- 2. 'numeros-1': the two examples were arithmetic sentences using
-- 加/等于 ("plus"/"equals"), words never taught anywhere in the
-- course — replaced with plain number readings (11 through 99) that
-- only exercise what this lesson actually teaches, including a
-- two-digit example (67) as requested. The "Contar del 1 al 10"
-- explanation only gestured at the 11-99 pattern in one dense
-- sentence; expanded into a full walkthrough of how tens+units
-- combine, with several worked examples.
--
-- 3. 'clasificadores': adds a second grammar point acknowledging that
-- Mandarin has dozens of classifiers (this lesson only teaches 4),
-- wrapped in the existing [[AVANZADO]]-style reassurance that
-- recognizing them is enough for now — full memorization comes with
-- practice — followed by a plain-text reference list of the most
-- common ones beyond what's already taught.
--
-- 4. 'verbo-shi': "se niega con 不是 (nunca 没是)" is now an explicit
-- standalone warning sentence instead of a parenthetical aside, and
-- the 吗-question mention (previously a single clause inside the
-- identification explanation) is split into its own full grammar
-- point with more examples, since forming yes/no questions is a
-- distinct skill from what 是 does.
-- ============================================

update public.mandarin_lessons set title = 'Expresar posesión con 的 (de)' where slug = 'posesion-de';
update public.mandarin_lessons set title = 'El número 两 (liǎng)' where slug = 'numero-liang';
update public.mandarin_lessons set title = 'Los verbos 要 (yào) y 想 (xiǎng)' where slug = 'verbos-yao-xiang';
update public.mandarin_lessons set title = 'El sufijo 儿 (ér)' where slug = 'sufijo-er';
update public.mandarin_lessons set title = 'Ser o no ser: el verbo 是 (shì)' where slug = 'verbo-shi';
update public.mandarin_lessons set title = 'Estar: el verbo 在 (zài)' where slug = 'verbo-zai';
update public.mandarin_lessons set title = 'El adverbio 只 (zhǐ)' where slug = 'adverbio-zhi';
update public.mandarin_lessons set title = 'Los adverbios 也 (yě) y 还 (hái)' where slug = 'adverbios-ye-hai';
update public.mandarin_lessons set title = 'El verbo 喜欢 (xǐhuan)' where slug = 'verbo-xihuan';
update public.mandarin_lessons set title = 'Haber y tener: el verbo 有 (yǒu)' where slug = 'verbo-you-ampliado';

-- numeros-1: richer explanation of the 11-99 pattern
update public.mandarin_grammar_points
set explanation = 'Los números del uno al diez son palabras individuales que se memorizan directamente: 一 (1), 二 (2), 三 (3), 四 (4), 五 (5), 六 (6), 七 (7), 八 (8), 九 (9), 十 (10). A partir de aquí, formar cualquier número del 11 al 99 sigue una fórmula fija, sin excepciones: [decenas]十[unidades]. 十一 (11) es literalmente "diez-uno" (10+1), 十五 (15) es "diez-cinco" (10+5) — el 十 solo, sin nada delante, ya significa "diez". Para las decenas completas, se antepone el número de decenas a 十: 二十 (20) es "dos-diez" (2×10), 三十 (30) es "tres-diez" (3×10), y así sucesivamente hasta 九十 (90). Para un número compuesto como 67, se combinan ambas partes: 六十七 (67) es "seis-diez-siete" (6×10+7) — el mismo patrón sirve para cualquier número entre el 21 y el 99, por ejemplo 三十五 (35, "tres-diez-cinco") o 九十九 (99, "nueve-diez-nueve"). A diferencia del español, que tiene palabras irregulares como "once", "veinte" o "cuarenta", el sistema chino es puramente matemático: una vez que sabes los diez números básicos y la palabra 十, puedes construir cualquier número hasta el 99 sin memorizar nada nuevo (al llegar a 100 aparece una palabra distinta, 百, que verás más adelante). El número 二 se usa para contar y en matemáticas (二加二等于四, "dos más dos es igual a cuatro"); verás una excepción importante en la lección del número 两 cuando 二 se combina con un clasificador.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'numeros-1')
  and title = 'Contar del 1 al 10';

delete from public.mandarin_examples
where lesson_id = (select id from public.mandarin_lessons where slug = 'numeros-1')
  and hanzi in ('一加一等于二。', '十加五等于十五。');

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('十一', 'Shíyī', 'Once (11).', 1),
  ('二十', 'Èrshí', 'Veinte (20).', 2),
  ('三十五', 'Sānshíwǔ', 'Treinta y cinco (35).', 3),
  ('四十八', 'Sìshíbā', 'Cuarenta y ocho (48).', 4),
  ('六十七', 'Liùshíqī', 'Sesenta y siete (67).', 5),
  ('八十九', 'Bāshíjiǔ', 'Ochenta y nueve (89).', 6),
  ('九十九', 'Jiǔshíjiǔ', 'Noventa y nueve (99).', 7)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'numeros-1'
on conflict do nothing;

-- clasificadores: acknowledge there are many more, list the most common
insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Hay muchos más clasificadores', '[[AVANZADO]]En chino hay decenas de clasificadores distintos — casi cada categoría de objetos tiene el suyo propio. No hace falta memorizarlos todos desde ahora: con que los reconozcas cuando los veas es suficiente: poco a poco, con la práctica, los irás recordando solos.[[/AVANZADO]] Estos son algunos de los más comunes en la conversación cotidiana, además de 个/本/只/张 que ya viste: 条 (tiáo, para cosas largas y delgadas como pantalones o peces), 杯 (bēi, para tazas o vasos de bebida), 件 (jiàn, para prendas de ropa), 辆 (liàng, para vehículos con ruedas) y 位 (wèi, versión formal y respetuosa de 个 para personas).', 2
from public.mandarin_lessons where slug = 'clasificadores'
on conflict do nothing;

-- verbo-shi: clearer negation warning + dedicated 吗 section
update public.mandarin_grammar_points
set explanation = '是 (shì) conecta dos sustantivos para decir que uno ES el otro, con la estructura A + 是 + B: 我是学生 ("yo soy estudiante"). Nunca se usa 没是 para negarlo: la negación de 是 siempre es 不是, sin excepción — 我不是学生 ("no soy estudiante"), nunca 我没是学生. El error más frecuente de quien empieza a estudiar chino es usar 是 con adjetivos: en español decimos "el gato ES negro", pero en chino los adjetivos funcionan como verbos y NO llevan 是 — se dice 猫很黑 (el gato es negro), nunca 猫是黑. 是 se reserva exclusivamente para conectar dos sustantivos o frases nominales, nunca un sustantivo con un adjetivo.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'verbo-shi')
  and title = '是 para identificar y clasificar';

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Preguntas de sí/no con 吗', 'Para convertir cualquier afirmación en una pregunta de sí/no, basta con añadir la partícula 吗 (ma) al final de la frase, sin cambiar nada más en el orden de las palabras: 你是学生 ("eres estudiante") se convierte en 你是学生吗? ("¿eres estudiante?"). Esto funciona con cualquier verbo, no solo con 是: 你有猫吗? ("¿tienes gato?"), 你去学校吗? ("¿vas a la escuela?"). Existe una segunda forma de preguntar lo mismo, repitiendo el verbo en su forma afirmativa y luego negativa: 你是不是学生? es exactamente la misma pregunta que 你是学生吗?, solo que sin la partícula 吗 al final — ambas formas son igual de correctas y comunes, y se puede usar la que se prefiera. Para responder, generalmente se repite el verbo en vez de decir una palabra suelta como "sí" o "no": a "你是学生吗?" se responde "是" (sí, "lo soy") o "不是" (no, "no lo soy").', 2
from public.mandarin_lessons where slug = 'verbo-shi'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你是学生吗？', 'Nǐ shì xuéshēng ma?', '¿Eres estudiante?', 3
from public.mandarin_lessons where slug = 'verbo-shi'
on conflict do nothing;
