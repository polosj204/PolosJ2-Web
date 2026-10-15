-- PolosJ2 admin development migration
-- Apply only after reviewing in an isolated/staging Supabase project.
-- Do NOT run against production until the staging panel is validated.

alter table public.orders
  add column if not exists is_test boolean not null default false;

comment on column public.orders.is_test is
  'Marks an administrative/test order so it can be excluded from commercial reporting.';

-- Preserve the existing admin-only UPDATE policy; do not add DELETE permissions here.
-- Hard deletion is intentionally not enabled until foreign-key behavior and staging
-- isolation have been verified. Test orders can be marked and excluded from metrics first.
