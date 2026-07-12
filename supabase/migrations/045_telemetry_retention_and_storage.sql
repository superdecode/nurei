-- Telemetry retention + storage hardening.
--
-- 1. page_performance_events / page_load_errors grow unbounded — the track
--    endpoint now runs a probabilistic cleanup (30-day retention); these
--    plain created_at indexes make that delete cheap.
-- 2. Enforce the media bucket size/mime limits even if the bucket pre-existed
--    (004 used `on conflict do nothing`, which skips settings on re-runs).

create index if not exists idx_ppe_created_at on page_performance_events (created_at);
create index if not exists idx_ple_created_at on page_load_errors (created_at);

-- One-time cleanup of anything already older than the retention window
delete from page_performance_events where created_at < now() - interval '30 days';
delete from page_load_errors        where created_at < now() - interval '30 days';

-- Bucket limits apply to every upload path, including the service role
update storage.buckets
set
  file_size_limit = 5242880, -- 5MB
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']
where id = 'media';
