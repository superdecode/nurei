-- ============================================
-- MANDARIN: 好 (hǎo, "bien/bueno") is used as the syllable-structure
-- example in the pinyin lesson's new overview section but didn't
-- exist as its own vocab item (only the compound 你好), so its
-- example chip had no audio. Sourced from Wikimedia Commons (Lingua
-- Libre project, CC BY-SA 4.0).
-- ============================================

insert into public.mandarin_vocab_items (hanzi, pinyin, es, audio_url) values
  ('好', 'hǎo', 'bien/bueno', 'https://upload.wikimedia.org/wikipedia/commons/d/d3/LL-Q9192_%28cmn%29-Luilui6666-%E5%A5%BD.wav')
on conflict do nothing;
