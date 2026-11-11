-- ============================================
-- MANDARIN: add a real uniqueness guard on vocabulary rows.
-- Every mandarin_vocab_items insert in this branch already uses
-- `on conflict do nothing` assuming duplicates are prevented, but with
-- no unique constraint that clause was always a silent no-op. This has
-- caused two real Critical bugs in review (吃/说 and 这 each got
-- accidentally re-inserted, producing ambiguous duplicate rows).
--
-- The constraint is on (hanzi, pinyin), not hanzi alone: Chinese has
-- genuine homographs — the same character with different pronunciations
-- and meanings, e.g. 只 (zhī, classifier for animals) vs. 只 (zhǐ,
-- "solamente") — which this course's own content intentionally teaches
-- as two distinct vocabulary entries. A bare unique(hanzi) constraint
-- would silently reject the second, legitimate entry as if it were a
-- duplicate of the first. Verified via grep across every
-- mandarin_vocab_items insert in supabase/migrations/ that no actual
-- duplicate (hanzi, pinyin) pairs exist today, so this applies cleanly.
-- ============================================

alter table public.mandarin_vocab_items
  add constraint mandarin_vocab_items_hanzi_pinyin_key unique (hanzi, pinyin);
