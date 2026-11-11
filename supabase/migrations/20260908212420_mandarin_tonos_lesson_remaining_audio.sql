-- ============================================
-- MANDARIN: audio for 腿 (tuǐ, "pierna"), the last word in the tonos
-- lesson's vocab bank that didn't have a recording yet. Sourced from
-- Wikimedia Commons (Lingua Libre project, CC BY-SA 4.0), same as the
-- rest of this project's audio.
-- ============================================

update public.mandarin_vocab_items
set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/9/9a/LL-Q9192_%28cmn%29-Jouketou-%E8%85%BF.wav'
where hanzi = '腿';
