-- ============================================
-- MANDARIN: audio for 你 (nǐ, "tú"), just added to the pinyin
-- lesson's vocab list and missing a recording. Sourced from
-- Wikimedia Commons (Lingua Libre project, CC BY-SA 4.0).
-- ============================================

update public.mandarin_vocab_items
set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/5/5f/LL-Q9192_%28cmn%29-Luilui6666-%E4%BD%A0.wav'
where hanzi = '你';
