ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS carrier text;

-- Legacy consolidation: this used to live in a second 037 file.
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_favorite boolean not null default false;
