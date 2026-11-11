-- ============================================
-- MANDARIN: the only Mandarin recording of 怕 available on Wikimedia
-- Commons was reported (by ear) as incorrect. No alternate recording
-- exists for that word, so the pinyin lesson's aspiration chart now
-- uses 朋友 (péngyou, "amigo") to demonstrate the aspirated "p" sound
-- instead — already a real vocab word in this course, recorded by the
-- same contributor (Luilui6666) already used successfully elsewhere
-- in this same chart. Clears 怕's audio_url since it's now unused and
-- was flagged wrong; the ConsonantPairChart component itself was
-- updated separately (client-side, hardcoded URLs, no DB read).
-- ============================================

update public.mandarin_vocab_items
set audio_url = 'https://upload.wikimedia.org/wikipedia/commons/c/cc/LL-Q9192_%28cmn%29-Luilui6666-%E6%9C%8B%E5%8F%8B.wav'
where hanzi = '朋友';

update public.mandarin_vocab_items
set audio_url = null
where hanzi = '怕';
