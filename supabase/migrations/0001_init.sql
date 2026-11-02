-- ============================================================
-- BaksoKu — Migration 0001: Struktur Skema
-- ============================================================
-- Terapkan berurutan:
--   supabase/migrations/0001_init.sql
--   supabase/migrations/0002_rls.sql
--   supabase/migrations/0003_functions.sql
--
-- Ketentuan desain:
-- - UUID sebagai primary key.
-- - numeric (bukan float) untuk uang dan kuantitas.
-- - timestamptz untuk waktu, Asia/Jakarta untuk logika zona waktu.
-- - snapshot harga/nama/resep pada tabel transaksi agar laporan
--   historis tidak berubah saat master data diperbarui.
-- - setiap perubahan stok WAJIB melalui stock_movements (jurnal).
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ------------------------------------------------------------
-- Bisnis & Profil (1 pemilik, tidak ada pendaftaran publik)
-- ------------------------------------------------------------
create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null check (length(name) between 1 and 200),
  phone text,
  address text,
  currency text not null default 'IDR',
  timezone text not null default 'Asia/Jakarta',
  qr_menu_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
  qr_menu_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9._-]{3,30}$'),
  full_name text not null,
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default now()
);

create index profiles_business_idx on public.profiles (business_id);

-- ------------------------------------------------------------
-- Perangkat kasir (offline-first)
-- ------------------------------------------------------------
create table public.devices (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  device_code text not null check (device_code <> ''),
  label text,
  is_active boolean not null default true,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, device_code)
);

create index devices_business_idx on public.devices (business_id);

-- ------------------------------------------------------------
-- Katalog: kategori, produk, varian
-- ------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null check (length(name) between 1 and 120),
  description text,
  photo_url text,
  price numeric(14, 2) not null check (price >= 0),
  is_available boolean not null default true,   -- habis atau tersedia hari ini
  is_active boolean not null default true,      -- aktif = tampil di kasir & QR menu
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_business_idx on public.products (business_id);
create index products_category_idx on public.products (category_id);
create index products_active_idx on public.products (business_id, is_active);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  price numeric(14, 2) not null check (price >= 0), -- override harga produk
  is_available boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_variants_product_idx on public.product_variants (product_id);

-- ------------------------------------------------------------
-- Bahan baku
-- ------------------------------------------------------------
create table public.units (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null,        -- contoh: Kilogram
  symbol text not null,      -- contoh: kg
  unique (business_id, symbol)
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  name text not null check (length(name) between 1 and 120),
  minimum_stock numeric(14, 4) not null default 0 check (minimum_stock >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, name)
);

create index ingredients_business_idx on public.ingredients (business_id);

-- Saldo & biaya rata-rata tertimbang bergerak (moving weighted average)
-- qty & avg_cost adalah satu-satunya sumber kebenaran nilai persediaan.
create table public.stock_balances (
  ingredient_id uuid primary key references public.ingredients(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  qty numeric(14, 4) not null default 0,
  avg_cost numeric(14, 4) not null default 0 check (avg_cost >= 0),
  updated_at timestamptz not null default now()
);

create index stock_balances_business_idx on public.stock_balances (business_id);

-- Jurnal pergerakan stok. Tidak boleh mengubah saldo tanpa catatan di sini.
-- qty_change: positif = masuk, negatif = keluar.
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  movement_type text not null check (movement_type in
    ('purchase', 'sale', 'void', 'refund', 'adjustment', 'opname', 'waste', 'initial')),
  qty_change numeric(14, 4) not null check (qty_change <> 0),
  unit_cost numeric(14, 4) check (unit_cost is null or unit_cost >= 0),
  ref_type text,           -- 'sale', 'purchase', 'manual', ...
  ref_id uuid,
  ref_note text,
  device_id uuid references public.devices(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null default now()
);

create index stock_movements_business_idx on public.stock_movements (business_id, occurred_at desc);
create index stock_movements_ingredient_idx on public.stock_movements (ingredient_id, occurred_at desc);
create index stock_movements_ref_idx on public.stock_movements (ref_type, ref_id);

-- ------------------------------------------------------------
-- Resep & HPP
-- ------------------------------------------------------------
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  product_id uuid not null unique references public.products(id) on delete cascade,
  name text,
  note text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  -- bahan spesifik untuk satu varian; null = berlaku semua varian
  product_variant_id uuid references public.product_variants(id) on delete cascade,
  qty numeric(14, 4) not null check (qty > 0),
  note text
);

create index recipe_items_recipe_idx on public.recipe_items (recipe_id);

-- ------------------------------------------------------------
-- Pengeluaran & kas
-- ------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  category text not null check (category in
    ('electricity', 'water', 'gas', 'salary', 'transport', 'other')),
  description text not null check (length(description) between 1 and 300),
  amount numeric(14, 2) not null check (amount > 0),
  spent_at date not null,
  created_at timestamptz not null default now()
);

create index expenses_business_date_idx on public.expenses (business_id, spent_at desc);

create table public.cash_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  source text not null check (source in
    ('sale', 'refund', 'purchase', 'expense', 'capital', 'adjustment')),
  ref_type text,
  ref_id uuid,
  amount numeric(14, 2) not null check (amount > 0),
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index cash_transactions_business_idx on public.cash_transactions (business_id, occurred_at desc);

-- ------------------------------------------------------------
-- Pemasok & pembelian
-- ------------------------------------------------------------
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  phone text,
  address text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  ref_no text not null check (length(ref_no) between 1 and 40),
  purchase_date date not null,
  total numeric(14, 2) not null default 0 check (total >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid')),
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'cancelled')),
  receipt_url text,          -- path di Supabase Storage (opsional)
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, ref_no)
);

create index purchases_business_idx on public.purchases (business_id, purchase_date desc);

create table public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  purchase_id uuid not null references public.purchases(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete restrict,
  qty numeric(14, 4) not null check (qty > 0),
  unit_cost numeric(14, 4) not null check (unit_cost >= 0),
  line_total numeric(14, 2) generated always as (round(qty * unit_cost, 2)) stored
);

create index purchase_items_purchase_idx on public.purchase_items (purchase_id);

-- Catatan: pembelian persediaan TIDAK langsung dihitung sebagai HPP.
-- HPP dicatat saat bahan benar-benar terpakai (penjualan). Total pembelian
-- memengaruhi laporan melalui nilai persediaan & aliran kas, bukan P&L langsung.

-- ------------------------------------------------------------
-- Nomor nota (-counter per hari, atomik)
-- ------------------------------------------------------------
create table public.receipt_counters (
  business_id uuid not null references public.businesses(id) on delete cascade,
  day date not null,
  last_seq integer not null default 0,
  primary key (business_id, day)
);

-- ------------------------------------------------------------
-- Penjualan
-- ------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  receipt_no text not null unique,
  idempotency_key text not null unique,   -- UUID dari klien, mencegah duplikasi
  channel text not null default 'pos' check (channel in ('pos', 'online')),
  order_type text not null default 'takeaway' check (order_type in ('dine_in', 'takeaway')),
  -- table_id ditambahkan setelah tabel dining_tables dibuat (lihat bawah)
  customer_id uuid,
  customer_name text,
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  discount numeric(14, 2) not null default 0 check (discount >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  paid_amount numeric(14, 2) not null default 0 check (paid_amount >= 0),
  change_amount numeric(14, 2) not null default 0 check (change_amount >= 0),
  hpp_total numeric(14, 2) not null default 0 check (hpp_total >= 0),
  status text not null default 'completed' check (status in ('completed', 'voided', 'refunded')),
  void_reason text,
  refund_amount numeric(14, 2) not null default 0 check (refund_amount >= 0),
  device_id uuid references public.devices(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  occurred_at timestamptz not null,        -- waktu transaksi menurut perangkat
  synced_at timestamptz,                   -- kapan tiba di server
  local_day date,                          -- hari lokal (Asia/Jakarta) untuk pelaporan
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint sales_totals_chk check (total <= subtotal - discount + 0.001 and change_amount >= paid_amount - total - 0.001)
);

comment on table public.sales is
  'Harga/unit/nama produk disimpan sebagai snapshot di sale_items agar riwayat tidak berubah saat master data diupdate. local_day = tanggal transaksi menurut zona waktu Asia/Jakarta untuk pelaporan harian.';

create index sales_business_occurred_idx on public.sales (business_id, occurred_at desc);
create index sales_business_status_idx on public.sales (business_id, status, occurred_at desc);
create index sales_device_idx on public.sales (device_id, occurred_at desc);

create table public.dining_tables (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 1 and 40),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

-- kolom table_id ditambahkan di sini karena dining_tables baru didefinisikan
alter table public.sales add column table_id uuid references public.dining_tables(id) on delete set null;

create table public.sale_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text,
  qty numeric(14, 3) not null check (qty > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),  -- snapshot harga saat transaksi
  line_total numeric(14, 2) not null check (line_total >= 0),
  note text
);

create index sale_items_sale_idx on public.sale_items (sale_id);

-- Snapshot resep saat transaksi terjadi: HPP historis tidak berubah
-- meski resep atau harga bahan diperbarui kemudian.
create table public.sale_item_recipe_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_item_id uuid not null references public.sale_items(id) on delete cascade,
  product_id uuid,
  ingredient_id uuid,
  ingredient_name text not null,
  qty numeric(14, 4) not null,             -- qty bahan per unit terjual (attrs: kali qty item)
  consumed_qty numeric(14, 4) not null,    -- qty bahan yang benar-benar dikonsumsi baris ini
  unit_symbol text,
  unit_cost numeric(14, 4) not null default 0,  -- avg_cost saat transaksi
  line_cost numeric(14, 2) not null default 0   --
);

create index recipe_snapshot_sale_item_idx on public.sale_item_recipe_snapshots (sale_item_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  sale_id uuid not null references public.sales(id) on delete cascade,
  method text not null check (method in ('cash', 'qris')),
  amount numeric(14, 2) not null check (amount > 0),
  status text not null default 'paid' check (status in ('paid', 'pending', 'failed', 'refunded')),
  provider_ref text,          -- referensi penyedia pembayaran (QRIS dinamis)
  paid_at timestamptz,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index payments_sale_idx on public.payments (sale_id);
create index payments_status_idx on public.payments (business_id, status);

comment on table public.payments is
  'Untuk QRIS dinamis: status mulai pending dan hanya boleh menjadi paid setelah verifikasi dari penyedia pembayaran (webhook / cek status). Screenshot pelanggan bukan bukti pembayaran.';

-- ------------------------------------------------------------
-- Pelanggan
-- ------------------------------------------------------------
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  name text not null check (length(name) between 1 and 120),
  phone text check (phone is null or length(phone) between 5 and 20),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_business_idx on public.customers (business_id);
create unique index customers_business_phone_uniq on public.customers (business_id, phone) where phone is not null;

-- ------------------------------------------------------------
-- Pesanan digital (QR Menu) — ditulis via server route, bukan anon langsung
-- ------------------------------------------------------------
create table public.digital_orders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_code text not null unique,           -- kode pendek untuk tracking pelanggan
  customer_name text not null check (length(customer_name) between 1 and 80),
  order_type text not null default 'dine_in' check (order_type in ('dine_in', 'takeaway')),
  table_no text,
  status text not null default 'new' check (status in ('new', 'accepted', 'rejected', 'completed', 'cancelled')),
  note text,
  total numeric(14, 2) not null default 0 check (total >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index digital_orders_business_status_idx on public.digital_orders (business_id, status, created_at desc);

create table public.digital_order_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  order_id uuid not null references public.digital_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text,
  qty numeric(14, 3) not null check (qty > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_total numeric(14, 2) not null check (line_total >= 0)
);

create index digital_order_items_order_idx on public.digital_order_items (order_id);

-- ------------------------------------------------------------
-- Sinkronisasi, idempotency, audit
-- ------------------------------------------------------------
create table public.sync_operations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  device_id uuid references public.devices(id) on delete set null,
  operation text not null check (operation in ('sale', 'stock_reconcile', 'heartbeat')),
  local_ref text,
  payload jsonb,
  status text not null default 'pending' check (status in ('pending', 'processed', 'failed')),
  error text,
  attempts integer not null default 0 check (attempts >= 0),
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index sync_operations_business_idx on public.sync_operations (business_id, created_at desc);

create table public.idempotency_keys (
  key text primary key,
  business_id uuid not null references public.businesses(id) on delete cascade,
  scope text not null,
  sale_id uuid references public.sales(id) on delete set null,
  created_at timestamptz not null default now()
);

create index idempotency_keys_business_idx on public.idempotency_keys (business_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,          -- 'create', 'update', 'delete', 'void', 'refund', ...
  entity text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);

-- ------------------------------------------------------------
-- Utility: updated_at otomatis
-- ------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'businesses','categories','products','product_variants','ingredients',
    'suppliers','purchases','customers','digital_orders','recipes',
    'stock_balances','dining_tables'
  ] loop
    execute format('drop trigger if exists trg_touch_%s on public.%I', t, t);
    execute format(
      'create trigger trg_touch_%s before update on public.%I
       for each row execute function public.touch_updated_at()', t, t);
  end loop;
end;
$$;
