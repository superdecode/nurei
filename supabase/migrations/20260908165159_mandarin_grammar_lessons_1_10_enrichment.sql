-- ============================================
-- MANDARIN: enrich lessons 1-10's explanations with more depth
-- (exceptions, mnemonics, character-composition notes) and add a
-- few supporting vocabulary words to the thinner lessons.
-- DEMO content, original writing — pending review by Elian.
-- ============================================

update public.mandarin_grammar_points
set explanation = 'Los pronombres chinos no cambian por género en el habla: 他 (tā, "él") y 她 (tā, "ella") suenan idénticos, solo se distinguen al escribirlos — el radical 女 (mujer) en 她 es una invención moderna del siglo XX para poder distinguirlos por escrito, copiando la distinción de idiomas europeos. 您 (nín) es la forma formal de 你 (tú): fíjate que 您 se escribe como 你 con 心 (xīn, "corazón") debajo — un recordatorio visual de que hablarle a alguien de forma respetuosa viene "del corazón". El plural se forma agregando 们 (men) al final: 你们 (ustedes), 他们/她们 (ellos/ellas), pero nunca se dice 您们 — para el plural formal simplemente se repite 您 o se usa 你们 con un tono respetuoso. Un dato curioso: los objetos y animales también tienen su propio pronombre, 它 (tā, "ello"), que suena igual que 他/她 pero se escribe con 宀 (techo) arriba en vez de llevar 亻 o 女 — refleja que en chino hasta los pronombres distinguen entre personas y cosas. También existe 咱们 (zánmen), que SIEMPRE incluye al oyente ("tú y yo"), a diferencia de 我们 que puede incluirlo o no.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'pronombres-personales')
  and title = 'Formalidad e igualdad de sonido';

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('它', 'tā', 'ello (para objetos y animales)'),
  ('咱们', 'zánmen', 'nosotros (incluye siempre al oyente)')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('它', 9), ('咱们', 10)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'pronombres-personales'
on conflict do nothing;

update public.mandarin_grammar_points
set explanation = 'A diferencia del español, los sustantivos chinos nunca cambian de forma: no tienen género gramatical (no hay equivalente a "el/la") y no se pluralizan añadiendo una letra. 书 (shū) significa tanto "libro" como "libros" — el contexto, un número, o un clasificador (que verás más adelante) indican la cantidad. La única excepción real es 们 (men), y solo se usa con sustantivos que se refieren a PERSONAS: 朋友们 ("amigos") es válido, pero 猫们 o 书们 suenan incorrectos — para plural de animales u objetos, el chino no marca nada en el sustantivo mismo. Otro punto importante: como los sustantivos no llevan artículo, 我有书 puede significar "tengo un libro", "tengo libros" o "tengo el libro", según lo que ya se sepa por contexto — el chino confía mucho más en el contexto que el español.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'sustantivos')
  and title = 'Sin género ni plural';

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('苹果', 'píngguǒ', 'manzana')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, v.ord
from public.mandarin_lessons les
join (values ('桌子', 7), ('苹果', 8)) as v(hanzi, ord) on true
join public.mandarin_vocab_items v2 on v2.hanzi = v.hanzi
where les.slug = 'sustantivos'
on conflict do nothing;

update public.mandarin_grammar_points
set explanation = 'Para decir "de quién" es algo, se coloca 的 (de) entre el poseedor y lo poseído: 我的书 (wǒ de shū) es "mi libro". El carácter 的 combina 白 (bái, "blanco/claro") con 勺 (sháo, "cuchara") — una forma útil de recordarlo es pensar que marca algo "claramente perteneciente a" alguien. Con relaciones cercanas (familia, amigos íntimos) el 的 suele omitirse: se dice 我妈妈 ("mi mamá") en vez de 我的妈妈, aunque ambas formas son válidas — omitir 的 transmite más cercanía emocional, no es solo un atajo. 的 también se usa para convertir casi cualquier frase en un adjetivo posesivo o descriptivo: 老师的书包 ("la mochila del profesor"), 我朋友的猫 ("el gato de mi amigo"). Un error común de principiantes es olvidar 的 y decir 我书包 en vez de 我的书包 — a diferencia del inglés ("my"), el chino sí necesita la partícula explícita salvo en esas relaciones cercanas ya mencionadas.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'posesion-de')
  and title = 'Poseedor + 的 + poseído';

update public.mandarin_grammar_points
set explanation = 'Los verbos chinos jamás se conjugan: la misma forma sirve para "yo como", "tú comes" o "ellos comieron" — el tiempo se indica con palabras de tiempo (昨天 "ayer", 明天 "mañana") o partículas que verás en lecciones futuras (了, 过, 在), nunca cambiando el verbo mismo. Esto hace que aprender verbos chinos sea, en cierto sentido, más simple que en español: no hay que memorizar conjugaciones. El orden básico de la oración es Sujeto + Verbo + Objeto, igual que en español: 我们去学校 (Wǒmen qù xuéxiào) = "Nosotros vamos a la escuela". Una diferencia importante: en chino no se puede omitir el sujeto tan libremente como en español (en español "voy a la escuela" omite el "yo"; en chino se prefiere 我去学校 explícito, aunque en conversación informal a veces también se omite si es obvio por contexto).'
where lesson_id = (select id from public.mandarin_lessons where slug = 'verbos')
  and title = 'Verbos invariables y orden SVO';

update public.mandarin_grammar_points
set explanation = '不 (bù) niega la mayoría de los verbos y adjetivos en presente o futuro: 我不吃 ("no como"). 没 o 没有 (méi/méiyǒu) se usa para negar 有 (tener/haber) y acciones pasadas ya completadas: 我没有书 ("no tengo libro"), 我没吃 ("no comí"/"no he comido"). Nunca se usa 不有 — siempre es 没有. Un detalle de tonos importante: 不 normalmente se pronuncia con cuarto tono (bù), pero cambia a segundo tono (bú) cuando va justo antes de otra sílaba de cuarto tono — por eso "no ser" se escribe 不是 pero se pronuncia búshì, no bùshì. Este cambio concreto solo lo tiene 不; 没 nunca cambia de tono (recuerda que el sandhi de los terceros tonos, que ya viste, es otra regla distinta). Para responder "no" a una pregunta de sí/no, generalmente se repite el verbo negado en vez de decir una palabra suelta como "no": a "你是学生吗?" (¿eres estudiante?) se responde "不是" (no lo soy), no simplemente "不".'
where lesson_id = (select id from public.mandarin_lessons where slug = 'oraciones-negativas')
  and title = '不 versus 没/没有';

update public.mandarin_grammar_points
set explanation = 'Los números del uno al diez son palabras individuales que se memorizan directamente: 一 (1), 二 (2), 三 (3), 四 (4), 五 (5), 六 (6), 七 (7), 八 (8), 九 (9), 十 (10). A partir del 11 se combinan de forma completamente regular y predecible: 十一 (11) es literalmente "diez-uno", 二十 (20) es "dos-diez", 二十一 (21) es "dos-diez-uno" — a diferencia del español, que tiene palabras irregulares como "once" o "veinte", el sistema chino es puramente matemático y por eso es más fácil de aprender una vez que dominas del 1 al 10. El número 二 se usa para contar y en matemáticas (二加二等于四, "dos más dos es igual a cuatro"); verás una excepción importante en la lección del número 两 cuando 二 se combina con un clasificador.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'numeros-1')
  and title = 'Contar del 1 al 10';

update public.mandarin_grammar_points
set explanation = 'En chino, un número casi nunca va directo sobre un sustantivo: necesita una palabra de medida (clasificador) en medio, con la estructura Número + Clasificador + Sustantivo. 个 (ge) es el clasificador genérico, útil cuando no sabes cuál usar — de hecho, muchos hablantes nativos lo usan como comodín en conversación informal incluso cuando técnicamente correspondería otro clasificador. 本 (běn) se usa para libros y publicaciones (viene de la idea de "raíz/volumen" de un libro), 只 (zhī) para animales, y 张 (zhāng) para objetos planos como hojas de papel, mesas o fotos. Ejemplo: 一个人 (una persona), 三只猫 (tres gatos). Los clasificadores también se usan con demostrativos (这个, "este") y no solo con números.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'clasificadores')
  and title = 'Número + clasificador + sustantivo';

update public.mandarin_grammar_points
set explanation = '二 (èr) se usa para contar en secuencia y en matemáticas (二, 十二, 二十), pero cuando se especifica la cantidad "dos" de algo junto a un clasificador, se usa 两 (liǎng) en su lugar: 两个人 (dos personas), nunca 二个人. La excepción es 二十 (20), que sigue usando 二 aunque contenga la idea de "dos dieces" — piensa en 两 como el "dos" que se usa para contar cosas concretas, y 二 como el "dos" abstracto de las matemáticas y los números de varias cifras. Un truco para recordarlo: 两 aparece casi siempre seguido de un clasificador (两个, 两只, 两本), mientras que 二 aparece solo o como parte de un número más grande (十二, 二十二). Con la hora también se usa 两 en vez de 二: "las dos en punto" es 两点 (liǎng diǎn), no 二点.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'numero-liang')
  and title = '两 en vez de 二 ante un clasificador';

update public.mandarin_grammar_points
set explanation = '很多 (hěn duō, "mucho/muchos") y 一些 (yìxiē, "algunos/unos") van directo antes del sustantivo, sin necesitar un clasificador: 很多朋友 (muchos amigos), 一些书 (algunos libros). 一点儿 (yìdiǎnr, "un poco") se usa típicamente con sustantivos no contables como el agua: 一点儿水 (un poco de agua) — nota el 儿 al final, una característica del mandarín del norte/Pekín. Estas tres expresiones de cantidad son en sí mismas suficientes: no se combinan con clasificadores (no se dice 很多个朋友), porque ya funcionan como su propio cuantificador. Además de 很多, existe 好多 (hǎoduō) como sinónimo coloquial, más común en el habla cotidiana que en el chino escrito formal.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'expresar-cantidad')
  and title = '很多, 一些 y 一点儿';

update public.mandarin_grammar_points
set explanation = 'Ambos se traducen como "querer", pero con matices distintos. 要 (yào) es más directo e inmediato — expresa una necesidad o un deseo concreto de hacer algo ahora, y también funciona como "voy a" cuando indica una acción planeada: 我要喝水 ("quiero/necesito beber agua"). 想 (xiǎng) es más suave y reflexivo, como un deseo o intención general, y literalmente comparte el carácter con 想 de "pensar" — 想 combina 相 (xiāng, aspecto/mutuo) con 心 (corazón), sugiriendo que el deseo nace "en el corazón" antes de convertirse en acción: 我想去中国 ("me gustaría ir a China" / "pienso en ir a China"). Ambos se colocan antes del verbo o sustantivo deseado. Una combinación común es 想要 (xiǎngyào), que junta ambos matices para expresar un deseo firme: 我想要一本书 ("quiero de verdad un libro"). Para negar, se usa 不想 (no tener ganas de) mucho más que 不要, que suena más como una orden ("¡no!") que como una negación suave del deseo.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'verbos-yao-xiang')
  and title = '要 vs 想: dos formas de "querer"';
