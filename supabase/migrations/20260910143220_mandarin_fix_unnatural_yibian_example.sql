-- ============================================
-- MANDARIN: 'yibian-yibian' example 3 paired 骑马 ("montar a caballo")
-- with 说汉语 ("hablar chino") — a random, nonsensical combination of
-- activities for a "doing two things at once" lesson. Adds 电视
-- (diànshì, "televisión") as new vocabulary so the example can be a
-- natural, common pairing instead.
-- ============================================

insert into public.mandarin_vocab_items (hanzi, pinyin, es) values
  ('电视', 'diànshì', 'televisión')
on conflict do nothing;

insert into public.mandarin_lesson_vocab (lesson_id, vocab_id, order_index)
select les.id, v.id, 2
from public.mandarin_lessons les
join public.mandarin_vocab_items v on v.hanzi = '电视'
where les.slug = 'yibian-yibian'
on conflict do nothing;

update public.mandarin_examples
set hanzi = '我一边看电视，一边喝茶。',
    pinyin = 'Wǒ yìbiān kàn diànshì, yìbiān hē chá.',
    es = 'Veo la televisión mientras bebo té.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'yibian-yibian')
  and hanzi = '我一边骑马，一边说汉语。';
