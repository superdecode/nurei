# Supabase Migrations

This project uses the Supabase CLI as the only schema migration path.

## Current State

- Active directory: `supabase/migrations/`
- Linked project ref: `jotoxalbyvbppvgtdbee`
- Remote Postgres major version: `17`
- Legacy migrations `001` through `041` are already part of the remote history and remain frozen.
- The former duplicate local files for versions `011`, `017`, and `037` were consolidated into their matching active version files so `db push` can compare one local file per remote version.

## Required Flow

Create every new migration with the CLI:

```bash
npx supabase migration new descriptive_name
```

Write SQL only in the generated timestamped file under `supabase/migrations/`.

Apply and verify:

```bash
npx supabase db push --linked
npx supabase migration list --linked
npx supabase inspect db index-stats --linked
```

Do not apply permanent schema changes through the dashboard SQL editor or custom Management API scripts.

## Index Checklist

After each migration that creates or changes tables, confirm common filters have indexes:

- Foreign keys used in child-table lookups, for example `product_id`, `order_id`, `customer_id`, `user_id`.
- Frequent status filters, for example `status`, `payment_status`, `is_active`.
- Date range filters, for example `created_at`, `paid_at`, `refunded_at`.
- Composite indexes for common combined filters, for example `(customer_id, created_at)`.

Use `inspect db index-stats` after production traffic has exercised the feature. Watch for high `seq_scans` with low `index_scans`, and for primary keys marked unused on tables that should have traffic.
