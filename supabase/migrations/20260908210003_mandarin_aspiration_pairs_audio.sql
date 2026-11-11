-- ============================================
-- MANDARIN: audio for the pinyin lesson's aspiration-pairs
-- illustration (b/p, d/t, g/k, j/q, z/c), sourced from the Lingua
-- Libre project via Wikimedia Commons (CC BY-SA 4.0 / CC0 — linked
-- directly, not re-hosted). Adds 3 genuinely new vocab words (怕, 字,
-- 菜) needed to demonstrate p/z/c, and backfills audio_url on 6
-- already-existing words this reuses (八, 大, 他, 高, 看, 家) — those
-- also benefit any other lesson where they're shown.
-- ============================================

insert into public.mandarin_vocab_items (hanzi, pinyin, es, audio_url) values
  ('怕', 'pà', 'miedo', 'https://upload.wikimedia.org/wikipedia/commons/2/25/LL-Q9192_%28cmn%29-%E9%9B%B2%E8%A7%92-%E6%80%95.wav'),
  ('字', 'zì', 'carácter/palabra', 'https://upload.wikimedia.org/wikipedia/commons/e/ed/LL-Q9192_%28cmn%29-Jouketou-%E5%AD%97.wav'),
  ('菜', 'cài', 'comida/verdura', 'https://upload.wikimedia.org/wikipedia/commons/8/81/LL-Q9192_%28cmn%29-Levi_Highway_%28%E5%88%97%E7%BB%B4%E5%8A%B3%E5%BE%B7%29-%E8%8F%9C.wav')
on conflict do nothing;

update public.mandarin_vocab_items set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/7/71/LL-Q9192_%28cmn%29-Luilui6666-%E5%85%AB.wav' where hanzi = '八';
update public.mandarin_vocab_items set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/2/22/LL-Q9192_%28cmn%29-Luilui6666-%E5%A4%A7.wav' where hanzi = '大';
update public.mandarin_vocab_items set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/b/bb/LL-Q9192_%28cmn%29-Luilui6666-%E4%BB%96.wav' where hanzi = '他';
update public.mandarin_vocab_items set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/1/1f/LL-Q9192_%28cmn%29-Jouketou-%E9%AB%98.wav' where hanzi = '高';
update public.mandarin_vocab_items set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/7/7d/LL-Q9192_%28cmn%29-Luilui6666-%E7%9C%8B.wav' where hanzi = '看';
update public.mandarin_vocab_items set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/5/53/LL-Q9192_%28cmn%29-Luilui6666-%E5%AE%B6.wav' where hanzi = '家';
