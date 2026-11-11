-- ============================================
-- MANDARIN: fix a newly-added example for 'adverbios-ye-hai' that
-- misapplied its own lesson's grammar point. The lesson explicitly
-- teaches that 还 ("además") adds a NEW item to the SAME subject's
-- existing list (我有书，还有笔), while 也 ("también") connects TWO
-- DIFFERENT subjects sharing a trait. The added example used 还 across
-- two different subjects (他.../我...), contradicting that rule.
-- ============================================

update public.mandarin_examples
set hanzi = '我喜欢看书，还喜欢跳舞。',
    pinyin = 'Wǒ xǐhuan kàn shū, hái xǐhuan tiàowǔ.',
    es = 'Me gusta leer, y además me gusta bailar.'
where lesson_id = (select id from public.mandarin_lessons where slug = 'adverbios-ye-hai')
  and hanzi = '他也喜欢跳舞，我还喜欢看书。';
