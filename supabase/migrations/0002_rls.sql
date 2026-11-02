-- ============================================================
-- BaksoKu — Migration 0002: Row Level Security
-- ============================================================
-- Aplikasi ini hanya untuk PEMILIK (satu user). Semua tabel meng-
-- gunakan RLS; anon tidak punya akses apa pun — QR Menu publik
-- dilayani lewat server route (service role), bukan PostgREST anon.
-- ============================================================

-- helper: apakah user yang login adalah pemilik bisnis ini?
create or replace function public.app_is_owner(p_business uuid) returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business and b.owner_id = auth.uid()
  );
$$;

revoke execute on function public.app_is_owner(uuid) from anon, authenticated;
-- authenticated hanya another client calling it indirectly via policies
grant execute on function public.app_is_owner(uuid) to authenticated;
grant execute on function public.app_is_owner(uuid) to service_role;

-- ------------------------------------------------------------
-- businesses & profiles (pemilik hanya bisa melihat/mengubah miliknya)
-- ------------------------------------------------------------
alter table public.businesses enable row level security;
create policy businesses_owner_all on public.businesses
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table public.profiles enable row level security;
create policy profiles_owner_all on public.profiles
  for all using (id = auth.uid()) with check (
    id = auth.uid() and
    exists (select 1 from public.businesses b where b.id = business_id and b.owner_id = auth.uid())
  );

-- ------------------------------------------------------------
-- Helper untuk generate policy semua tabel dengan kolom business_id
-- ------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'devices','categories','products','product_variants','units','ingredients',
    'stock_balances','stock_movements','recipes','recipe_items','expenses',
    'cash_transactions','suppliers','purchases','purchase_items',
    'receipt_counters','sales','sale_items','sale_item_recipe_snapshots',
    'payments','dining_tables','customers','digital_orders','digital_order_items',
    'sync_operations','idempotency_keys','audit_logs'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I_owner_all on public.%I
         for all
         using (public.app_is_owner(business_id))
         with check (public.app_is_owner(business_id))', t, t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Penutupan akses anon
-- ------------------------------------------------------------
-- Supabase default memberi grant tabel ke anon & authenticated; karena tabel
-- sudah diproteksi RLS, anon ditolak otomatis. Untuk pertahanan berlapis,
-- revoke semua grant anon:
do $$
declare
  t text;
begin
  foreach t in array array[
    'devices','categories','products','product_variants','units','ingredients',
    'stock_balances','stock_movements','recipes','recipe_items','expenses',
    'cash_transactions','suppliers','purchases','purchase_items',
    'receipt_counters','sales','sale_items','sale_item_recipe_snapshots',
    'payments','dining_tables','customers','digital_orders','digital_order_items',
    'sync_operations','idempotency_keys','audit_logs'
  ] loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Fungsi RPC yang dipanggil dari client harus granted
-- (lihat 0003_functions.sql untuk definisinya)
-- ------------------------------------------------------------
