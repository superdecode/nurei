-- ============================================
-- MANDARIN: per-vocab-word usage example columns.
-- A word's usage example is a property of the word itself (vocab
-- items are already shared across lessons via mandarin_lesson_vocab),
-- not of any one lesson — so this lives on mandarin_vocab_items,
-- not as a new join table. All three columns are nullable: most of
-- the ~170 existing vocab rows won't have one until a later content
-- pass fills them in, and the UI must degrade gracefully for those.
-- ============================================

alter table public.mandarin_vocab_items add column if not exists example_hanzi text;
alter table public.mandarin_vocab_items add column if not exists example_pinyin text;
alter table public.mandarin_vocab_items add column if not exists example_es text;
