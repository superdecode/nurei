-- ============================================
-- MANDARIN: the tonos lesson's 2nd example used 字/两个, words never
-- taught or explained in this lesson, and one exercise pulled in 腿
-- ("pierna") purely to build a sentence about a numb leg — unrelated
-- to the lesson's actual topic (the 4-tone minimal pair 妈/麻/马/骂).
-- Both replaced with content built entirely from that same set of
-- words, and 腿 is unlinked from this lesson's vocab list.
-- ============================================

update public.mandarin_examples
set hanzi = '妈妈骂马。', pinyin = 'Māma mà mǎ.', es = 'Mamá regaña al caballo.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'tonos')
  and hanzi = '这个字有两个音, 不是一个。';

update public.mandarin_exercises
set prompt = 'Ordena la frase: "Mamá regaña al caballo."',
    data = jsonb_build_object('tokens', jsonb_build_array('妈妈', '骂', '马'), 'correct_order', jsonb_build_array(0,1,2))
where lesson_id = (select id from public.mandarin_lessons where slug = 'tonos')
  and prompt = 'Ordena la frase para decir que la pierna se te entumió: "Se me entumió la pierna."';

delete from public.mandarin_lesson_vocab
where lesson_id = (select id from public.mandarin_lessons where slug = 'tonos')
  and vocab_id = (select id from public.mandarin_vocab_items where hanzi = '腿');
