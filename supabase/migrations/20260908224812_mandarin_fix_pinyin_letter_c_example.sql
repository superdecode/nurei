-- ============================================
-- MANDARIN: the pinyin lesson's first explanation mentioned 才 (cái)
-- inside a reversed phrase ("como en 才 cái") that doesn't match this
-- app's "hanzi (pinyin, ...)" convention, so the word never appeared
-- as a clickable example chip with audio like every other example in
-- that same paragraph. Rewritten to the standard pattern, and 才
-- added to the vocab bank with audio (Wikimedia Commons, Lingua
-- Libre, CC BY-SA 4.0).
-- ============================================

insert into public.mandarin_vocab_items (hanzi, pinyin, es, audio_url) values
  ('才', 'cái', 'apenas/hasta (entonces)', 'https://upload.wikimedia.org/wikipedia/commons/0/05/LL-Q9192_%28cmn%29-Jouketou-%E6%89%8D.wav')
on conflict do nothing;

update public.mandarin_grammar_points
set explanation = replace(
  explanation,
  'La letra c en pinyin (como en 才 cái) tampoco es una k ni una s: suena como "ts" en "gatsby".',
  'La letra c en pinyin tampoco es una k ni una s — en 才 (cái) suena como "ts" en "gatsby".'
)
where lesson_id = (select id from public.mandarin_lessons where slug = 'pinyin')
  and explanation like '%La letra c en pinyin (como en 才 cái) tampoco es una k ni una s: suena como "ts" en "gatsby".%';
