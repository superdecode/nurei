-- ============================================
-- MANDARIN: the pinyin lesson's examples used 一点儿 and 学校, both
-- too advanced for the very first lesson of the course (a beginner
-- hasn't been taught either word or its grammar yet). Replaced with
-- 4 short, simple phrases built entirely from words already
-- introduced in this same lesson. Also adds 你 to the lesson's
-- vocab list.
-- ============================================

update public.mandarin_examples
set hanzi = '你好。', pinyin = 'Nǐ hǎo.', es = 'Hola.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and hanzi = '谢谢你说汉语。';

update public.mandarin_examples
set hanzi = '谢谢你。', pinyin = 'Xièxiè nǐ.', es = 'Gracias a ti.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and hanzi = '我说一点儿汉语。';

update public.mandarin_examples
set hanzi = '我去。', pinyin = 'Wǒ qù.', es = 'Yo voy.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and hanzi = '他去学校。';

insert into public.mandarin_examples (lesson_id, hanzi, pinyin, es, order_index)
select id, '你吃。', 'Nǐ chī.', 'Tú comes.', 4
from public.mandarin_lessons where slug = 'pinyin'
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v2.id, 8
from public.mandarin_lessons les
join public.mandarin_vocab_items v2 on v2.hanzi = '你'
where les.slug = 'pinyin'
on conflict do nothing;
