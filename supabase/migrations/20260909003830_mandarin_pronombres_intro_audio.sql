-- ============================================
-- MANDARIN: the pronombres lesson's Introduccion already listed the
-- main pronouns (我/你/他/她) with example chips, but only 你 had
-- audio (他 already did, from an earlier lesson's aspiration chart).
-- Adds audio for 我 and 她 (她 is a true homophone of 他 - both are
-- pronounced tā, exactly as this lesson's own text explains - so
-- 他's existing recording is reused for it, not a mismatch).
--
-- Also fixes the 2nd grammar point's plural-pronoun sentence: it
-- glossed 我们/你们 with no Spanish translation and combined
-- 他们/她们 into a single non-Han-contiguous mention ("他们/她们"),
-- which the chip-extraction regex can only ever parse as "他们" -
-- 她们 silently never got a chip. Split into 4 individual mentions,
-- each following this course's "hanzi (pinyin, gloss)" convention,
-- and added the missing 她们 vocab entry with audio (all sourced from
-- Wikimedia Commons, Lingua Libre project, CC BY-SA 4.0 / CC0).
-- ============================================

update public.mandarin_vocab_items
set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/b/b4/LL-Q9192_%28cmn%29-Luilui6666-%E6%88%91.wav'
where hanzi = '我';

update public.mandarin_vocab_items
set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/b/bb/LL-Q9192_%28cmn%29-Luilui6666-%E4%BB%96.wav'
where hanzi = '她';

insert into public.mandarin_vocab_items (hanzi, pinyin, es, audio_url) values
  ('我们', 'wǒmen', 'nosotros', 'https://upload.wikimedia.org/wikipedia/commons/6/6d/LL-Q9192_%28cmn%29-Luilui6666-%E6%88%91%E4%BB%AC.wav'),
  ('你们', 'nǐmen', 'ustedes', 'https://upload.wikimedia.org/wikipedia/commons/5/55/LL-Q9192_%28cmn%29-Luilui6666-%E4%BD%A0%E4%BB%AC.wav'),
  ('他们', 'tāmen', 'ellos', 'https://upload.wikimedia.org/wikipedia/commons/5/5a/LL-Q9192_%28cmn%29-Wang_Cheng_%28Yug%29-%E4%BB%96%E4%BB%AC.wav'),
  ('她们', 'tāmen', 'ellas', 'https://upload.wikimedia.org/wikipedia/commons/5/5a/LL-Q9192_%28cmn%29-Wang_Cheng_%28Yug%29-%E4%BB%96%E4%BB%AC.wav')
on conflict do nothing;

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  '我们 (wǒmen) es "nosotros", 你们 (nǐmen) es "ustedes", 他们/她们 (tāmen) es "ellos/ellas".',
  '我们 (wǒmen, "nosotros"), 你们 (nǐmen, "ustedes"), 他们 (tāmen, "ellos") y 她们 (tāmen, "ellas").'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'pronombres')
  and explanation like '%他们/她们 (tāmen) es "ellos/ellas".%';
