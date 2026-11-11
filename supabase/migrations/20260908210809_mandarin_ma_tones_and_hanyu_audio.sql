-- ============================================
-- MANDARIN: audio for the 4 tones lesson (妈/麻/马/骂 minimal-pair
-- syllables) and 汉语, the two gaps left over from the earlier
-- Wikimedia Commons pass (no matching recording existed for these).
-- Provided directly by Elian and hosted in this project's own
-- 'mandarin-audio' Supabase Storage bucket (public bucket already
-- created in 20260908050219_mandarin_audio_columns.sql).
-- ============================================

update public.mandarin_vocab_items
set audio_url = 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/ma-tono1.mp3'
where hanzi = '妈';

update public.mandarin_vocab_items
set audio_url = 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/ma-tono2.mp3'
where hanzi = '麻';

update public.mandarin_vocab_items
set audio_url = 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/ma-tono3.mp3'
where hanzi = '马';

update public.mandarin_vocab_items
set audio_url = 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/ma-tono4.mp3'
where hanzi = '骂';

update public.mandarin_vocab_items
set audio_url = 'https://jotoxalbyvbppvgtdbee.supabase.co/storage/v1/object/public/mandarin-audio/hanyu.mp3'
where hanzi = '汉语';
