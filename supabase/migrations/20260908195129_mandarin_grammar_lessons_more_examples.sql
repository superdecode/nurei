-- ============================================
-- MANDARIN: bring every "Gramática" lesson's Ejemplos section up to at
-- least 2 examples (several get 3). Each new sentence reuses vocabulary
-- already taught by that point in the course (the 5 "Introducción al
-- chino" lessons, or an earlier-ordered Gramática lesson) rather than
-- introducing new words. DEMO content, original writing.
-- ============================================

-- pronombres-personales
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '咱们是学生，他们是老师。', 'Zánmen shì xuéshēng, tāmen shì lǎoshī.', 'Nosotros somos estudiantes, ellos son profesores.', 2
from public.mandarin_lessons where slug = 'pronombres-personales'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '您叫什么名字？', 'Nín jiào shénme míngzi?', '¿Cómo se llama usted?', 3
from public.mandarin_lessons where slug = 'pronombres-personales'
on conflict do nothing;

-- sustantivos
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有苹果，我的朋友有书。', 'Wǒ yǒu píngguǒ, wǒ de péngyou yǒu shū.', 'Tengo una manzana, mi amigo tiene un libro.', 2
from public.mandarin_lessons where slug = 'sustantivos'
on conflict do nothing;

-- posesion-de
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这是爸爸的书，这是妈妈的书包。', 'Zhè shì bàba de shū, zhè shì māma de shūbāo.', 'Este es el libro de papá, esta es la mochila de mamá.', 2
from public.mandarin_lessons where slug = 'posesion-de'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '爸爸的朋友是老师。', 'Bàba de péngyou shì lǎoshī.', 'El amigo de papá es profesor.', 3
from public.mandarin_lessons where slug = 'posesion-de'
on conflict do nothing;

-- verbos
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我们说汉语，我们看书。', 'Wǒmen shuō hànyǔ, wǒmen kàn shū.', 'Hablamos chino, leemos libros.', 2
from public.mandarin_lessons where slug = 'verbos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我喝水，你吃苹果。', 'Wǒ hē shuǐ, nǐ chī píngguǒ.', 'Yo bebo agua, tú comes una manzana.', 3
from public.mandarin_lessons where slug = 'verbos'
on conflict do nothing;

-- oraciones-negativas
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你不喝水吗？', 'Nǐ bù hē shuǐ ma?', '¿No bebes agua?', 2
from public.mandarin_lessons where slug = 'oraciones-negativas'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他没有猫，我没有狗。', 'Tā méiyǒu māo, wǒ méiyǒu gǒu.', 'Él no tiene gato, yo no tengo perro.', 3
from public.mandarin_lessons where slug = 'oraciones-negativas'
on conflict do nothing;

-- numeros-1
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '十加五等于十五。', 'Shí jiā wǔ děngyú shíwǔ.', 'Diez más cinco es igual a quince.', 2
from public.mandarin_lessons where slug = 'numeros-1'
on conflict do nothing;

-- clasificadores
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有一本书。', 'Wǒ yǒu yì běn shū.', 'Tengo un libro.', 2
from public.mandarin_lessons where slug = 'clasificadores'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有一只猫。', 'Wǒ yǒu yì zhī māo.', 'Tengo un gato.', 3
from public.mandarin_lessons where slug = 'clasificadores'
on conflict do nothing;

-- numero-liang
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我没有两只狗，我有两只猫。', 'Wǒ méiyǒu liǎng zhī gǒu, wǒ yǒu liǎng zhī māo.', 'No tengo dos perros, tengo dos gatos.', 2
from public.mandarin_lessons where slug = 'numero-liang'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他有二十个朋友。', 'Tā yǒu èrshí gè péngyou.', 'Él tiene veinte amigos.', 3
from public.mandarin_lessons where slug = 'numero-liang'
on conflict do nothing;

-- expresar-cantidad
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我有一些书，我有一点儿水。', 'Wǒ yǒu yìxiē shū, wǒ yǒu yìdiǎnr shuǐ.', 'Tengo algunos libros, tengo un poco de agua.', 2
from public.mandarin_lessons where slug = 'expresar-cantidad'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他有一些朋友，我有很多朋友。', 'Tā yǒu yìxiē péngyou, wǒ yǒu hěn duō péngyou.', 'Él tiene algunos amigos, yo tengo muchos amigos.', 3
from public.mandarin_lessons where slug = 'expresar-cantidad'
on conflict do nothing;

-- verbos-yao-xiang
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我要看书。', 'Wǒ yào kàn shū.', 'Quiero leer un libro (ahora).', 2
from public.mandarin_lessons where slug = 'verbos-yao-xiang'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他想去学校。', 'Tā xiǎng qù xuéxiào.', 'Él piensa en ir a la escuela.', 3
from public.mandarin_lessons where slug = 'verbos-yao-xiang'
on conflict do nothing;

-- verbo-shi
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他是不是老师？', 'Tā shì bú shì lǎoshī?', '¿Es profesor o no?', 2
from public.mandarin_lessons where slug = 'verbo-shi'
on conflict do nothing;

-- demostrativos
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这是我的猫，那是你的狗。', 'Zhè shì wǒ de māo, nà shì nǐ de gǒu.', 'Este es mi gato, ese es tu perro.', 2
from public.mandarin_lessons where slug = 'demostrativos'
on conflict do nothing;

-- sufijo-er
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他想去那儿玩。', 'Tā xiǎng qù nàr wán.', 'Él quiere ir allí a jugar.', 2
from public.mandarin_lessons where slug = 'sufijo-er'
on conflict do nothing;

-- verbo-zai
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '爸爸在家，妈妈在学校。', 'Bàba zài jiā, māma zài xuéxiào.', 'Papá está en casa, mamá está en la escuela.', 2
from public.mandarin_lessons where slug = 'verbo-zai'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你在哪儿？我在这里。', 'Nǐ zài nǎr? Wǒ zài zhèlǐ.', '¿Dónde estás? Estoy aquí.', 3
from public.mandarin_lessons where slug = 'verbo-zai'
on conflict do nothing;

-- adjetivos
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我的猫很小，你的狗很大。', 'Wǒ de māo hěn xiǎo, nǐ de gǒu hěn dà.', 'Mi gato es pequeño, tu perro es grande.', 2
from public.mandarin_lessons where slug = 'adjetivos'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '她很漂亮，他很高。', 'Tā hěn piàoliang, tā hěn gāo.', 'Ella es bonita, él es alto.', 3
from public.mandarin_lessons where slug = 'adjetivos'
on conflict do nothing;

-- adverbios-grado
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '这个非常贵，那个有点儿贵。', 'Zhège fēicháng guì, nàge yǒudiǎnr guì.', 'Esto es sumamente caro, eso es un poco caro (y no me gusta).', 2
from public.mandarin_lessons where slug = 'adverbios-grado'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我的猫挺漂亮的。', 'Wǒ de māo tǐng piàoliang de.', 'Mi gato es bastante bonito.', 3
from public.mandarin_lessons where slug = 'adverbios-grado'
on conflict do nothing;

-- verbo-xihuan
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他喜欢看书，我喜欢狗。', 'Tā xǐhuan kàn shū, wǒ xǐhuan gǒu.', 'A él le gusta leer, a mí me gustan los perros.', 2
from public.mandarin_lessons where slug = 'verbo-xihuan'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你喜欢跳舞吗？', 'Nǐ xǐhuan tiàowǔ ma?', '¿Te gusta bailar?', 3
from public.mandarin_lessons where slug = 'verbo-xihuan'
on conflict do nothing;

-- verbo-you-ampliado
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '书在桌子上面。', 'Shū zài zhuōzi shàngmiàn.', 'El libro está sobre la mesa.', 2
from public.mandarin_lessons where slug = 'verbo-you-ampliado'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '桌子上没有苹果。', 'Zhuōzi shàng méiyǒu píngguǒ.', 'No hay manzana sobre la mesa.', 3
from public.mandarin_lessons where slug = 'verbo-you-ampliado'
on conflict do nothing;

-- adverbio-zhi
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他只喜欢跳舞。', 'Tā zhǐ xǐhuan tiàowǔ.', 'A él solo le gusta bailar.', 2
from public.mandarin_lessons where slug = 'adverbio-zhi'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '我只有一只猫。', 'Wǒ zhǐ yǒu yì zhī māo.', 'Solo tengo un gato.', 3
from public.mandarin_lessons where slug = 'adverbio-zhi'
on conflict do nothing;

-- adverbios-ye-hai
insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '他也喜欢跳舞，我还喜欢看书。', 'Tā yě xǐhuan tiàowǔ, wǒ hái xǐhuan kàn shū.', 'A él también le gusta bailar, y a mí además me gusta leer.', 2
from public.mandarin_lessons where slug = 'adverbios-ye-hai'
on conflict do nothing;

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你没有猫吗？我也没有。', 'Nǐ méiyǒu māo ma? Wǒ yě méiyǒu.', '¿No tienes gato? Yo tampoco tengo.', 3
from public.mandarin_lessons where slug = 'adverbios-ye-hai'
on conflict do nothing;
