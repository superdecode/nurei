-- ============================================
-- MANDARIN: many "Gramática básica" lessons had heavy theory but
-- only 2-3 examples to anchor it — examples are what makes the
-- theory click, not the explanation text alone. Adds 2 more examples
-- to each of the 14 lessons below, all built only from vocabulary
-- already taught by that point in the course (never forward-
-- referencing a word/grammar point from a later lesson).
-- ============================================

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('这是我朋友的猫。', 'Zhè shì wǒ péngyou de māo.', 'Este es el gato de mi amigo.', 4),
  ('这是妈妈的车。', 'Zhè shì māma de chē.', 'Este es el coche de mamá.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'posesion-de'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('他来我家。', 'Tā lái wǒ jiā.', 'Él viene a mi casa.', 4),
  ('我们喝茶，你们喝水。', 'Wǒmen hē chá, nǐmen hē shuǐ.', 'Nosotros bebemos té, ustedes beben agua.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'verbos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('老师有一个学生。', 'Lǎoshī yǒu yí gè xuéshēng.', 'El profesor tiene un estudiante.', 4),
  ('我有一只狗，我朋友有一只猫。', 'Wǒ yǒu yì zhī gǒu, wǒ péngyou yǒu yì zhī māo.', 'Tengo un perro, mi amigo tiene un gato.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'clasificadores'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('我们有两本书。', 'Wǒmen yǒu liǎng běn shū.', 'Tenemos dos libros.', 4),
  ('老师有两个学生。', 'Lǎoshī yǒu liǎng gè xuéshēng.', 'El profesor tiene dos estudiantes.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'numero-liang'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('他喝一点儿茶。', 'Tā hē yìdiǎnr chá.', 'Él bebe un poco de té.', 4),
  ('我们有一些钱。', 'Wǒmen yǒu yìxiē qián.', 'Tenemos algo de dinero.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'expresar-cantidad'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('她要喝水。', 'Tā yào hē shuǐ.', 'Ella quiere beber agua (ahora).', 4),
  ('我们想去中国。', 'Wǒmen xiǎng qù Zhōngguó.', 'Queremos ir a China (algún día).', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'verbos-yao-xiang'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('我们是朋友。', 'Wǒmen shì péngyou.', 'Somos amigos.', 4)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'verbo-shi'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('老师在那里。', 'Lǎoshī zài nàlǐ.', 'El profesor está allí.', 4),
  ('我朋友在家。', 'Wǒ péngyou zài jiā.', 'Mi amigo está en casa.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'verbo-zai'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('我的房子不大。', 'Wǒ de fángzi bú dà.', 'Mi casa no es grande.', 4),
  ('你很高，我很小。', 'Nǐ hěn gāo, wǒ hěn xiǎo.', 'Tú eres alto, yo soy bajo/a.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'adjetivos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('我的猫不太漂亮。', 'Wǒ de māo bú tài piàoliang.', 'Mi gato no es muy bonito.', 4),
  ('这只狗挺大的。', 'Zhè zhī gǒu tǐng dà de.', 'Este perro es bastante grande.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'adverbios-grado'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('我喜欢喝水。', 'Wǒ xǐhuan hē shuǐ.', 'Me gusta beber agua.', 4),
  ('她不喜欢跳舞。', 'Tā bù xǐhuan tiàowǔ.', 'A ella no le gusta bailar.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'verbo-xihuan'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('桌子上有水。', 'Zhuōzi shàng yǒu shuǐ.', 'Hay agua sobre la mesa.', 4),
  ('猫在桌子上面。', 'Māo zài zhuōzi shàngmiàn.', 'El gato está sobre la mesa.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'verbo-you-ampliado'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('我只喝茶。', 'Wǒ zhǐ hē chá.', 'Solo bebo té.', 4),
  ('他只想去学校。', 'Tā zhǐ xiǎng qù xuéxiào.', 'Él solo quiere ir a la escuela.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'adverbio-zhi'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, v.hanzi, v.pinyin, v.es, v.ord
from public.mandarin_lessons les
join (values
  ('他也喜欢看书。', 'Tā yě xǐhuan kàn shū.', 'A él también le gusta leer.', 4),
  ('我还有一只猫。', 'Wǒ hái yǒu yì zhī māo.', 'Además tengo un gato.', 5)
) as v(hanzi, pinyin, es, ord) on true
where les.slug = 'adverbios-ye-hai'
on conflict do nothing;
