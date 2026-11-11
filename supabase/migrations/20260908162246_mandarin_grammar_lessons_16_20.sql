-- ============================================
-- MANDARIN: Gramática — Básico avanzado, lessons 16-20.
-- DEMO ONLY, pending review by Elian. Original writing —
-- HanziBox's free course topic order used as reference only.
-- ============================================

insert into public.mandarin_lessons (unit_id, slug, title, objective, order_index, is_published)
select u.id, v.slug, v.title, v.objective, v.order_index, true
from public.mandarin_units u
join public.mandarin_levels l on l.id = u.level_id
join public.mandarin_courses c on c.id = l.course_id
join (values
  ('adverbios-grado', 'Adverbios de grado', 'Matizar adjetivos con 很, 太, 非常 y 有点儿.', 1),
  ('verbo-xihuan', 'El verbo 喜欢', 'Decir qué te gusta usando 喜欢, sin invertir el sujeto como en español.', 2),
  ('verbo-you-ampliado', 'Haber y tener: el verbo 有', 'Diferenciar 有 de existencia y 有 de posesión.', 3),
  ('adverbio-zhi', 'El adverbio 只', 'Decir "solamente" colocando 只 antes del verbo.', 4),
  ('adverbios-ye-hai', 'Los adverbios 也 y 还', 'Usar 也 ("también") y 还 ("todavía"/"además").', 5)
) as v(slug, title, objective, order_index) on true
where c.slug = 'curso-de-mandarin' and l.slug = 'gramatica-basico-avanzado' and u.slug = 'temas-avanzados'
on conflict (unit_id, slug) do nothing;

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('太', 'tài', 'demasiado (con 了 al final)'),
  ('非常', 'fēicháng', 'sumamente/extremadamente'),
  ('有点儿', 'yǒudiǎnr', 'un poco (con matiz negativo)'),
  ('挺', 'tǐng', 'bastante (coloquial)'),
  ('贵', 'guì', 'caro/a'),
  ('了', 'le', 'partícula que marca cambio de estado o finalización'),
  ('喜欢', 'xǐhuan', 'gustar'),
  ('跳舞', 'tiàowǔ', 'bailar'),
  ('上面', 'shàngmiàn', 'encima/arriba'),
  ('没有', 'méiyǒu', 'no tener/no haber'),
  ('桌子', 'zhuōzi', 'mesa'),
  ('只', 'zhǐ', 'solamente/solo (adverbio)'),
  ('一个', 'yí gè', 'uno (con clasificador genérico)'),
  ('也', 'yě', 'también'),
  ('还', 'hái', 'todavía/además')
on conflict do nothing;

-- Lesson: adverbios de grado
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('很', 1), ('太', 2), ('非常', 3), ('有点儿', 4), ('挺', 5), ('贵', 6), ('了', 7)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'adverbios-grado'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, 'Matizando "muy"', '很 (hěn) es el grado neutro por defecto que casi siempre acompaña a un adjetivo, y muchas veces no se traduce como "muy" (ver la lección de adjetivos). Para un énfasis real y fuerte, se usa 非常 (fēicháng, "sumamente"): 非常大 ("enorme"). 太...了 (tài...le) expresa "demasiado", casi siempre con una connotación negativa o de sorpresa, y necesita el 了 al final para sonar completo: 太贵了 ("¡es demasiado caro!"). 有点儿 (yǒudiǎnr, "un poco") también tiene un matiz negativo — se usa para quejarse suavemente de algo: 有点儿贵 ("un poco caro", implicando que no te gusta el precio) — esto lo distingue de 一点儿, que es neutral: se usa tanto con sustantivos (一点儿水, "un poco de agua") como DESPUÉS de un adjetivo para suavizar una comparación, sin el matiz de queja de 有点儿 (贵一点儿, "un poco más caro", 快一点儿, "un poco más rápido"). Por último, 挺 (tǐng, "bastante") es coloquial y muy común en el habla del norte de China, casi siempre acompañado de 的 al final de la frase: 挺好的 ("bastante bien").', 1
from public.mandarin_lessons where slug = 'adverbios-grado'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这个太贵了。', 'Zhège tài guì le.', 'Esto es demasiado caro.', 1
from public.mandarin_lessons where slug = 'adverbios-grado'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Cuál de estos expresa "un poco" con un matiz de queja?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '有点儿'),
    'options', jsonb_build_array('有点儿', '一点儿', '很'), 'correct_option', '有点儿'),
  1, true
from public.mandarin_lessons where slug = 'adverbios-grado'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Esto es demasiado caro."',
  jsonb_build_object('tokens', jsonb_build_array('这个', '太', '贵', '了'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'adverbios-grado'
on conflict do nothing;

-- Lesson: 喜欢
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('喜欢', 1), ('跳舞', 2), ('看', 3), ('狗', 4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'verbo-xihuan'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '喜欢 no se invierte como "gustar"', 'En español, "gustar" invierte el sujeto: "a mí me gustas TÚ" pone a la otra persona como sujeto gramatical. En chino, 喜欢 (xǐhuan) funciona como un verbo normal y directo: el que siente el gusto es el sujeto de la oración. 我喜欢你 se traduce como "tú me gustas", pero literalmente es "yo gusto-de ti" — el orden gramatical chino es más parecido al inglés "I like you" que al español. 喜欢 también puede tomar un verbo completo como objeto, no solo un sustantivo: 我喜欢跳舞 ("me gusta bailar", literalmente "yo gusto-de bailar"). Para preguntar, se usa 喜欢...吗? o 喜不喜欢? (repitiendo el verbo en afirmativo-negativo, igual que viste con 是). Para decir que algo te gusta MUCHO, se puede añadir 很 antes: 我很喜欢猫 ("me gustan mucho los gatos").', 1
from public.mandarin_lessons where slug = 'verbo-xihuan'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我很喜欢跳舞。', 'Wǒ hěn xǐhuan tiàowǔ.', 'Me gusta mucho bailar.', 1
from public.mandarin_lessons where slug = 'verbo-xihuan'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 跳舞?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '跳舞'),
    'options', jsonb_build_array('bailar', 'cantar', 'correr'), 'correct_option', 'bailar'),
  1, true
from public.mandarin_lessons where slug = 'verbo-xihuan'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Me gusta mucho bailar."',
  jsonb_build_object('tokens', jsonb_build_array('我', '很', '喜欢', '跳舞'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'verbo-xihuan'
on conflict do nothing;

-- Lesson: 有 ampliado (existencia vs posesión)
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('有', 1), ('桌子', 2), ('上面', 3), ('没有', 4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'verbo-you-ampliado'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '有 de existencia y 有 de posesión', 'Ya usaste 有 (yǒu) para decir "tener" (我有书, "tengo un libro") — pero 有 también sirve para decir que algo EXISTE en un lugar, con la estructura Lugar + 有 + Cosa: 桌子上有一本书 ("hay un libro sobre la mesa", literalmente "mesa-encima hay un libro"). La diferencia con 在 (que ya conoces) es el orden y el énfasis: 书在桌子上 pone el foco en DÓNDE está el libro (asumes que el libro existe y preguntas su ubicación), mientras que 桌子上有书 pone el foco en QUÉ hay en ese lugar (no sabes qué hay, y 有 te lo revela). Ambas frases pueden describir la misma situación real, pero responden preguntas distintas: "¿dónde está el libro?" (en) vs "¿qué hay sobre la mesa?" (有). La negación de 有 siempre es 没有 o simplemente 没, nunca 不有.', 1
from public.mandarin_lessons where slug = 'verbo-you-ampliado'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '桌子上有一本书。', 'Zhuōzi shàng yǒu yì běn shū.', 'Hay un libro sobre la mesa.', 1
from public.mandarin_lessons where slug = 'verbo-you-ampliado'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué estructura se usa para decir que algo EXISTE en un lugar?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '有'),
    'options', jsonb_build_array('Lugar + 有 + Cosa', 'Cosa + 有 + Lugar', 'Lugar + 是 + Cosa'), 'correct_option', 'Lugar + 有 + Cosa'),
  1, true
from public.mandarin_lessons where slug = 'verbo-you-ampliado'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "No hay libro sobre la mesa."',
  jsonb_build_object('tokens', jsonb_build_array('桌子上', '没有', '书'), 'correct_order', jsonb_build_array(0,1,2)),
  2, true
from public.mandarin_lessons where slug = 'verbo-you-ampliado'
on conflict do nothing;

-- Lesson: 只 (adverbio "solamente")
-- Disambiguated on (hanzi, pinyin): 只 now has two legitimate rows
-- (zhī, classifier vs. zhǐ, this lesson's adverb) since the uniqueness
-- guard on mandarin_vocab_items moved to (hanzi, pinyin). Joining on
-- hanzi alone would match both rows and link the wrong one to this
-- lesson, so every value here carries its pinyin for an exact match.
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('只', 'zhǐ', 1), ('有', 'yǒu', 2), ('朋友', 'péngyou', 3), ('一个', 'yí gè', 4)) as v(hanzi, pinyin, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi and v2.pinyin = v.pinyin
where les.slug = 'adverbio-zhi'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '只: colócalo antes del verbo', '只 (zhǐ, "solamente/solo") es un adverbio, y como todos los adverbios en chino, se coloca ANTES del verbo que modifica, sin importar dónde iría "solamente" en la traducción al español: 我只有一个朋友 ("solo tengo un amigo"). Ojo: 只 (zhǐ, "solamente") se escribe con el mismo carácter que 只 (zhī), el clasificador para animales que ya conoces — son homógrafos (se escriben igual) pero se pronuncian con tonos diferentes y tienen significados completamente distintos; el contexto siempre deja claro cuál es cuál. Un uso relacionado es 只是 (zhǐshì, "solo es que..."), útil para matizar una explicación: 我只是很累 ("es solo que estoy muy cansado").', 1
from public.mandarin_lessons where slug = 'adverbio-zhi'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我只有一个朋友。', 'Wǒ zhǐ yǒu yí gè péngyou.', 'Solo tengo un amigo.', 1
from public.mandarin_lessons where slug = 'adverbio-zhi'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Dónde se coloca 只 respecto al verbo?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '只' and pinyin = 'zhǐ'),
    'options', jsonb_build_array('antes', 'después', 'da igual'), 'correct_option', 'antes'),
  1, true
from public.mandarin_lessons where slug = 'adverbio-zhi'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Solo tengo un amigo."',
  jsonb_build_object('tokens', jsonb_build_array('我', '只', '有', '一个', '朋友'), 'correct_order', jsonb_build_array(0,1,2,3,4)),
  2, true
from public.mandarin_lessons where slug = 'adverbio-zhi'
on conflict do nothing;

-- Lesson: 也 y 还
insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('也', 1), ('还', 2), ('是', 3), ('学生', 4)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'adverbios-ye-hai'
on conflict do nothing;

insert into public.mandarin_grammar_points (lesson_id, title, explanation, order_index)
select id, '也 ("también") y 还 ("todavía"/"además")', '也 (yě, "también") siempre va antes del verbo, igual que 只 y todos los adverbios chinos: 我也是学生 ("yo también soy estudiante"). 还 (hái) es más flexible en significado según el contexto: puede significar "todavía" en frases como 我还没吃 ("todavía no he comido" — nota cómo se combina con 没 para negar), o "además/también" en el sentido de agregar algo nuevo a una lista: 我有书，还有笔 ("tengo un libro, y además un bolígrafo"). La diferencia entre 也 y este segundo uso de 还 es sutil: 也 conecta dos sujetos que comparten la misma característica (yo también, tú también), mientras que 还 añade un elemento nuevo a lo que ya se dijo sobre el mismo sujeto. Ambos van antes del verbo, nunca después.', 1
from public.mandarin_lessons where slug = 'adverbios-ye-hai'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我也是学生，我还有一个朋友。', 'Wǒ yě shì xuéshēng, wǒ hái yǒu yí gè péngyou.', 'Yo también soy estudiante, y además tengo un amigo.', 1
from public.mandarin_lessons where slug = 'adverbios-ye-hai'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'vocab_multiple_choice', '¿Qué significa 还没吃?',
  jsonb_build_object('vocab_id', (select id::text from public.mandarin_vocab_items where hanzi = '还'),
    'options', jsonb_build_array('todavía no he comido', 'ya comí', 'quiero comer'), 'correct_option', 'todavía no he comido'),
  1, true
from public.mandarin_lessons where slug = 'adverbios-ye-hai'
on conflict do nothing;

insert into public.mandarin_exercises (lesson_id, type, prompt, data, order_index, is_published)
select id, 'sentence_order', 'Ordena la frase: "Yo también soy estudiante."',
  jsonb_build_object('tokens', jsonb_build_array('我', '也', '是', '学生'), 'correct_order', jsonb_build_array(0,1,2,3)),
  2, true
from public.mandarin_lessons where slug = 'adverbios-ye-hai'
on conflict do nothing;
