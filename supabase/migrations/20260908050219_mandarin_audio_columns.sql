-- ============================================
-- MANDARIN: audio columns + storage bucket
-- ============================================

alter table public.mandarin_vocab_items add column if not exists audio_url text;
alter table public.mandarin_examples add column if not exists audio_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mandarin-audio',
  'mandarin-audio',
  true,
  2097152, -- 2MB, generous for a single word/sentence clip
  array['audio/mpeg']
)
on conflict (id) do nothing;

create policy "Mandarin audio: public read" on storage.objects
  for select using (bucket_id = 'mandarin-audio');
