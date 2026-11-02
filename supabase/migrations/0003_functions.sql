-- ============================================================
-- Bakso Yabes — Migration 0003: Fungsi Bisnis (RPC server-side atomik)
-- ============================================================
-- Semua proses penting berjalan ATOMIK di database (SQL PL/pgSQL):
-- 1) rpc_create_sale      → simpan transaksi + snapshot harga/resep
--                            + pengurangan stok + jurnal + idempotency.
-- 2) rpc_void_sale        → batalkan/refund + pemulihan stok + kas.
-- 3) rpc_confirm_purchase → stok masuk + update biaya rata-rata
--                            tertimbang bergerak + jurnal + kas.
-- 4) rpc_stock_adjustment → penyesuaian/opname melalui jurnal stok.
-- 5) rpc_stock_reconcile  → pemeriksaan konsistensi saldo vs jurnal.
-- ============================================================

create or replace function public.rpc_create_sale(p_payload jsonb) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business uuid;
  v_sale jsonb;
  v_item jsonb;
  v_r jsonb;
  v_recipe uuid;
  v_items int;
  v_subtotal numeric(14,2) := 0;
  v_discount numeric(14,2);
  v_total numeric(14,2);
  v_paid numeric(14,2);
  v_change numeric(14,2);
  v_hpp numeric(14,2) := 0;
  v_day date;
  v_seq int;
  v_receipt_no text;
  v_key text;
  v_existing_sale uuid;
  v_occurred timestamptz;
  v_method text;
  v_sale_id uuid;
  v_item_id uuid;
  v_variant uuid;
  v_qty numeric(14,3);
  v_line_total numeric(14,2);
  v_cost numeric(14,2) := 0;
begin
  -- bisnis pemilik (RLS: hanya pemilik)
  select p.business_id into v_business from public.profiles p where p.id = auth.uid();
  if v_business is null then
    raise exception 'ES_NOT_OWNER: profile pemilik tidak ditemukan';
  end if;

  v_key := nullif(p_payload->>'idempotency_key', '');
  if v_key is null then
    raise exception 'ES_VALIDATION: idempotency_key wajib ada';
  end if;
  v_occurred := coalesce(
    (p_payload->>'occurred_at')::timestamptz, now());

  -- kunci bisnis untuk nomor nota & mencegah race
  perform pg_advisory_xact_lock(hashtextextended('sales:' || v_business::text, 0));

  -- Elemen 1: cek idempotency ( klik berulang / re-sync )
  select ik.sale_id into v_existing_sale
    from public.idempotency_keys ik
    where ik.key = v_key and ik.business_id = v_business and ik.scope = 'sale';
  if v_existing_sale is not null then
    return jsonb_build_object(
      'status', 'already_exists',
      'sale_id', v_existing_sale,
      'receipt_no', (select s.receipt_no from public.sales s where s.id = v_existing_sale),
      'idempotency_key', v_key
    );
  end if;
  delete from public.idempotency_keys
    where key = v_key and business_id = v_business and scope = 'sale' and sale_id is null;

  -- Elemen 2: validasi item
  v_items := coalesce(jsonb_array_length(p_payload->'items'), 0);
  if v_items = 0 then
    raise exception 'ES_VALIDATION: minimal 1 item';
  end if;

  v_subtotal := 0;
  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    if coalesce((v_item->>'qty')::numeric, 0) <= 0
       or coalesce((v_item->>'unit_price')::numeric, -1) < 0 then
      raise exception 'ES_VALIDATION: qty dan unit_price item tidak boleh <= 0';
    end if;
    v_subtotal := v_subtotal + round((v_item->>'qty')::numeric * (v_item->>'unit_price')::numeric, 2);
  end loop;

  v_discount := least(greatest(coalesce((p_payload->>'discount')::numeric, 0), 0), v_subtotal);
  v_total := v_subtotal - v_discount;
  v_paid := coalesce((p_payload->>'paid_amount')::numeric, v_total);
  v_change := v_paid - v_total;
  if v_change < 0 then
    raise exception 'ES_VALIDATION: Pembayaran kurang dari total';
  end if;
  if v_paid < 0 or v_paid > 1000000000 then
    raise exception 'ES_VALIDATION: Nominal pembayaran tidak valid';
  end if;

  v_day := (v_occurred at time zone 'Asia/Jakarta')::date;

  -- Elemen 3: nomor nota unik (counter atomik per hari)
  insert into public.receipt_counters (business_id, day, last_seq)
    values (v_business, v_day, 1)
    on conflict (business_id, day)
    do update set last_seq = public.receipt_counters.last_seq + 1
    returning last_seq into v_seq;
  v_receipt_no := 'NOTA-' || to_char(v_day, 'YYYYMMDD') || '-' || lpad(v_seq::text, 4, '0');

  -- Elemen 4: simpan transaksi
  v_method := coalesce(p_payload->>'payment_method', 'cash');
  if v_method not in ('cash', 'qris') then
    raise exception 'ES_VALIDATION: metode pembayaran tidak valid';
  end if;

  insert into public.sales (
    business_id, receipt_no, idempotency_key, channel, order_type,
    table_id, customer_id, customer_name, subtotal, discount, total,
    paid_amount, change_amount, status, device_id, created_by,
    occurred_at, synced_at, local_day, note
  ) values (
    v_business, v_receipt_no, v_key,
    coalesce(nullif(p_payload->>'channel', ''), 'pos'),
    coalesce(nullif(p_payload->>'order_type', ''), 'takeaway'),
    (nullif(p_payload->>'table_id', ''))::uuid,
    (nullif(p_payload->>'customer_id', ''))::uuid,
    nullif(p_payload->>'customer_name', ''),
    v_subtotal, v_discount, v_total, v_paid, v_change,
    'completed',
    (nullif(p_payload->>'device_id', ''))::uuid,
    auth.uid(), v_occurred, now(), v_day,
    nullif(p_payload->>'note', '')
  ) returning id into v_sale_id;

  -- Elemen 5: items + snapshot harga
  for v_item in select * from jsonb_array_elements(p_payload->'items') loop
    v_qty       := (v_item->>'qty')::numeric;
    v_line_total:= round(v_qty * (v_item->>'unit_price')::numeric, 2);
    v_variant   := (v_item->>'variant_id')::uuid;

    insert into public.sale_items (
      business_id, sale_id, product_id, product_variant_id,
      product_name, variant_name, qty, unit_price, line_total, note
    ) values (
      v_business, v_sale_id,
      (v_item->>'product_id')::uuid, v_variant,
      coalesce(v_item->>'product_name', '(produk terhapus)'),
      v_item->>'variant_name',
      v_qty, (v_item->>'unit_price')::numeric, v_line_total,
      nullif(v_item->>'note', '')
    ) returning id into v_item_id;

    -- Elemen 6: snapshot resep & HPP
    if coalesce(v_item->>'product_id', '') <> '' then
      select r.id into v_recipe
        from public.recipes r
        where r.product_id = (v_item->>'product_id')::uuid
          and r.business_id = v_business
          and r.is_active
        limit 1;

      for v_r in
        select ri.ingredient_id::text as ingredient_id,
               i.name as ingredient_name,
               coalesce(u.symbol, i.name) as unit_symbol,
               ri.qty::numeric as qty_per_unit,
               coalesce(sb.avg_cost, 0)::numeric as unit_cost
        from public.recipe_items ri
        join public.ingredients i on i.id = ri.ingredient_id
        left join public.units u on u.id = i.unit_id
        left join public.stock_balances sb on sb.ingredient_id = i.id
        where ri.recipe_id = v_recipe
          and (ri.product_variant_id = v_variant or ri.product_variant_id is null)
          -- hindari double-count: jika bahan punya item khusus varian, jangan hitung item generiknya
          and not (
            ri.product_variant_id is null and v_variant is not null and exists (
              select 1 from public.recipe_items ri2
              where ri2.recipe_id = v_recipe
                and ri2.ingredient_id = ri.ingredient_id
                and ri2.product_variant_id = v_variant
            )
          )
      loop
        v_cost := round(((v_r->>'qty_per_unit')::numeric * v_qty * (v_r->>'unit_cost')::numeric)::numeric, 2);
        v_hpp := v_hpp + v_cost;

        insert into public.sale_item_recipe_snapshots (
          business_id, sale_item_id,
          product_id, ingredient_id, ingredient_name,
          qty, consumed_qty, unit_symbol, unit_cost, line_cost
        ) values (
          v_business, v_item_id,
          (v_item->>'product_id')::uuid,
          (v_r->>'ingredient_id')::uuid,
          v_r->>'ingredient_name',
          (v_r->>'qty_per_unit')::numeric,
          (v_r->>'qty_per_unit')::numeric * v_qty,
          v_r->>'unit_symbol',
          (v_r->>'unit_cost')::numeric,
          v_cost
        );
      end loop;
    end if;
  end loop;

  update public.sales set hpp_total = v_hpp where id = v_sale_id;

  -- Elemen 7: pengurangan stok (HPP/stok moment) - agregat per bahan
  for v_r in
    select snap.ingredient_id::text as iid,
           sum(snap.consumed_qty)::numeric as consumed,
           array_agg(snap.ingredient_name)[1] as nm
    from public.sale_items si
    join public.sale_item_recipe_snapshots snap on snap.sale_item_id = si.id
    where si.sale_id = v_sale_id and snap.ingredient_id is not null
    group by snap.ingredient_id
  loop
    -- balance: kurangi qty (bisa minus, karena transaksi offline; lihat rekonsiliasi)
    insert into public.stock_balances (ingredient_id, business_id, qty, avg_cost)
      values ((v_r->>'iid')::uuid, v_business, 0 - (v_r->>'consumed')::numeric, 0)
      on conflict (ingredient_id) do update
        set qty = public.stock_balances.qty + excluded.qty, updated_at = now();

    insert into public.stock_movements (
      business_id, ingredient_id, movement_type, qty_change, unit_cost,
      ref_type, ref_id, ref_note, device_id, created_by, occurred_at
    ) values (
      v_business, (v_r->>'iid')::uuid, 'sale', -1 * (v_r->>'consumed')::numeric, null,
      'sale', v_sale_id, v_receipt_no,
      (nullif(p_payload->>'device_id', ''))::uuid, auth.uid(), v_occurred
    );
  end loop;

  -- Elemen 8: pembayaran & kas
  insert into public.payments (
    business_id, sale_id, method, amount, status, provider_ref, paid_at
  ) values (
    v_business, v_sale_id, v_method, v_total,
    case when v_method = 'qris' and p_payload ? 'qris_pending' and (p_payload->>'qris_pending')::boolean
         then 'pending' else 'paid' end,
    nullif(p_payload->>'payment_provider_ref', ''),
    case when v_method = 'qris' and p_payload ? 'qris_pending' and (p_payload->>'qris_pending')::boolean
         then null else v_occurred end
  );

  if v_method = 'cash' then
    insert into public.cash_transactions (
      business_id, direction, source, ref_type, ref_id, amount, note, occurred_at
    ) values (
      v_business, 'in', 'sale', 'sale', v_sale_id, v_total,
      'Penjualan kasir ' || v_receipt_no, v_occurred
    );
  end if;

  -- Elemen 9: idempotency + sinkron naik + audit
  insert into public.idempotency_keys (key, business_id, scope, sale_id)
    values (v_key, v_business, 'sale', v_sale_id);

  insert into public.sync_operations (business_id, device_id, operation, local_ref, payload, status, processed_at)
    values (v_business, (nullif(p_payload->>'device_id', ''))::uuid, 'sale', v_key, p_payload,
            'processed', now());

  insert into public.audit_logs (business_id, user_id, action, entity, entity_id, detail)
    values (v_business, auth.uid(), 'create', 'sale', v_sale_id,
            jsonb_build_object('receipt_no', v_receipt_no, 'total', v_total, 'hpp', v_hpp));

  return jsonb_build_object(
    'status', 'ok',
    'sale_id', v_sale_id,
    'receipt_no', v_receipt_no,
    'total', v_total,
    'hpp_total', v_hpp,
    'occurred_at', v_occurred
  );
end;
$$;

-- ------------------------------------------------------------
-- VOID / REFUND — pemulihan stok & kas, atomik
-- ------------------------------------------------------------
create or replace function public.rpc_void_sale(
  p_sale_id uuid, p_mode text, p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business uuid;
  v_sale public.sales;
  v_r record;
  v_method text;
  v_status text;
begin
  if p_mode not in ('void', 'refund') then
    raise exception 'ES_VALIDATION: mode tidak valid';
  end if;
  if p_reason is null or length(trim(p_reason)) < 3 then
    raise exception 'ES_VALIDATION: alasan wajib diisi (min 3 karakter)';
  end if;

  select p.business_id into v_business from public.profiles p where p.id = auth.uid();
  if v_business is null then
    raise exception 'ES_NOT_OWNER: profile pemilik tidak ditemukan';
  end if;

  select * into v_sale from public.sales
    where id = p_sale_id and business_id = v_business for update;
  if not found then
    raise exception 'ES_NOT_FOUND: transaksi tidak ditemukan';
  end if;
  if v_sale.status <> 'completed' then
    raise exception 'ES_INVALID: hanya transaksi yang selesai dapat dibatalkan/direfund';
  end if;

  -- 1) pulihkan stok dari snapshot resep
  for v_r in
    select snap.ingredient_id as iid, sum(snap.consumed_qty)::numeric as consumed
    from public.sale_items si
    join public.sale_item_recipe_snapshots snap on snap.sale_item_id = si.id
    where si.sale_id = v_sale.id and snap.ingredient_id is not null
    group by snap.ingredient_id
  loop
    insert into public.stock_balances (ingredient_id, business_id, qty)
      values (v_r.iid, v_business, 0)
      on conflict (ingredient_id) do nothing;

    update public.stock_balances
      set qty = qty + v_r.consumed, updated_at = now()
      where ingredient_id = v_r.iid;

    insert into public.stock_movements (
      business_id, ingredient_id, movement_type, qty_change,
      ref_type, ref_id, ref_note, created_by
    ) values (
      v_business, v_r.iid, p_mode, v_r.consumed,
      'sale', v_sale.id,
      p_mode || ' ' || v_sale.receipt_no || ': ' || trim(p_reason),
      auth.uid()
    );
  end loop;

  -- 2) pembayaran → refunded
  select method into v_method from public.payments
    where sale_id = v_sale.id limit 1;
  update public.payments set status = 'refunded' where sale_id = v_sale.id;

  -- 3) kas keluar (uang dikembalikan) jika pembayaran tunai
  if v_method = 'cash' then
    insert into public.cash_transactions (
      business_id, direction, source, ref_type, ref_id, amount, note
    ) values (
      v_business, 'out', 'refund', 'sale', v_sale.id, v_sale.total,
      (case when p_mode = 'void' then 'Pembatalan' else 'Refund' end) || ' ' || v_sale.receipt_no || ': ' || trim(p_reason)
    );
  end if;

  -- 4) status transaksi
  v_status := case when p_mode = 'void' then 'voided' else 'refunded' end;
  update public.sales
    set status = v_status,
        void_reason = trim(p_reason),
        refund_amount = case when p_mode = 'refund' then total else 0 end,
        updated_at = now()
    where id = v_sale.id;

  insert into public.audit_logs (business_id, user_id, action, entity, entity_id, detail)
    values (v_business, auth.uid(), p_mode, 'sale', v_sale.id,
            jsonb_build_object('reason', trim(p_reason), 'receipt_no', v_sale.receipt_no));

  return jsonb_build_object('status', 'ok', 'sale_status', v_status);
end;
$$;

-- ------------------------------------------------------------
-- KONFIRMASI PEMBELIAN — stok masuk + biaya rata-rata tertimbang
-- bergerak + jurnal + kas. Pembelian TIDAK dihitung sebagai HPP.
-- ------------------------------------------------------------
create or replace function public.rpc_confirm_purchase(p_purchase_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business uuid;
  v_p public.purchases;
  v_r record;
  v_qty_old numeric(14,4);
  v_avg_old numeric(14,4);
  v_avg_new numeric(14,4);
  v_in_qty numeric(14,4);
  v_cost numeric(14,4);
  v_item_total numeric(14,2);
begin
  select p.business_id into v_business from public.profiles p where p.id = auth.uid();
  if v_business is null then
    raise exception 'ES_NOT_OWNER: profile pemilik tidak ditemukan';
  end if;

  select * into v_p from public.purchases
    where id = p_purchase_id and business_id = v_business for update;
  if not found then raise exception 'ES_NOT_FOUND: pembelian tidak ditemukan'; end if;
  if v_p.status <> 'draft' then
    raise exception 'ES_INVALID: pembelian sudah dikonfirmasi';
  end if;
  if not exists (select 1 from public.purchase_items where purchase_id = v_p.id) then
    raise exception 'ES_VALIDATION: pembelian tanpa item';
  end if;

  for v_r in select * from public.purchase_items where purchase_id = v_p.id loop
    v_in_qty := v_r.qty;
    v_cost   := v_r.unit_cost;
    select qty, avg_cost into v_qty_old, v_avg_old
      from public.stock_balances where ingredient_id = v_r.ingredient_id;
    if not found or v_qty_old <= 0 then
      v_avg_new := v_cost;
    else
      v_avg_new := round(((v_qty_old * v_avg_old + v_in_qty * v_cost) / (v_qty_old + v_in_qty)), 4);
    end if;

    insert into public.stock_balances (ingredient_id, business_id, qty, avg_cost)
      values (v_r.ingredient_id, v_business, v_in_qty, v_avg_new)
      on conflict (ingredient_id) do update
        set qty = public.stock_balances.qty + excluded.qty,
            avg_cost = excluded.avg_cost,
            updated_at = now();

    insert into public.stock_movements (
      business_id, ingredient_id, movement_type, qty_change, unit_cost,
      ref_type, ref_id, ref_note, created_by
    ) values (
      v_business, v_r.ingredient_id, 'purchase', v_in_qty, v_cost,
      'purchase', v_p.id, v_p.ref_no, auth.uid()
    );
  end loop;

  select coalesce(sum(line_total), 0) into v_item_total
    from public.purchase_items where purchase_id = v_p.id;
  update public.purchases
    set status = 'confirmed', total = v_item_total, updated_at = now()
    where id = v_p.id;

  if v_p.payment_status = 'paid' then
    insert into public.cash_transactions (
      business_id, direction, source, ref_type, ref_id, amount, note
    ) values (
      v_business, 'out', 'purchase', 'purchase', v_p.id, v_item_total,
      'Pembelian bahan ' || v_p.ref_no
    );
  end if;

  insert into public.audit_logs (business_id, user_id, action, entity, entity_id, detail)
    values (v_business, auth.uid(), 'confirm', 'purchase', v_p.id,
            jsonb_build_object('total', v_item_total, 'ref_no', v_p.ref_no));

  return jsonb_build_object('status', 'ok', 'total', v_item_total);
end;
$$;

-- ------------------------------------------------------------
-- PENYESUAIAN STOK — selalu via jurnal (movement + balance)
-- p_movement_type: adjustment | opname | waste | initial
-- p_qty adalah selisih (delta) terhadap saldo, bisa negatif.
-- ------------------------------------------------------------
create or replace function public.rpc_stock_adjustment(
  p_ingredient_id uuid, p_movement_type text, p_qty numeric, p_note text default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_business uuid;
  v_ing uuid;
begin
  if p_movement_type not in ('adjustment', 'opname', 'waste', 'initial') then
    raise exception 'ES_VALIDATION: tipe penyesuaian tidak valid';
  end if;
  if p_qty is null or p_qty = 0 then
    raise exception 'ES_VALIDATION: jumlah penyesuaian tidak boleh 0';
  end if;
  select p.business_id into v_business from public.profiles p where p.id = auth.uid();
  if v_business is null then
    raise exception 'ES_NOT_OWNER: profile pemilik tidak ditemukan';
  end if;

  select i.id into v_ing from public.ingredients i
    where i.id = p_ingredient_id and i.business_id = v_business;
  if v_ing is null then raise exception 'ES_NOT_FOUND: bahan tidak ditemukan'; end if;

  insert into public.stock_balances (ingredient_id, business_id, qty)
    values (v_ing, v_business, 0)
    on conflict (ingredient_id) do update set qty = public.stock_balances.qty
      where false;

  update public.stock_balances
    set qty = qty + p_qty, updated_at = now()
    where ingredient_id = v_ing;

  insert into public.stock_movements (
    business_id, ingredient_id, movement_type, qty_change,
    ref_type, ref_note, created_by
  ) values (
    v_business, v_ing, p_movement_type, p_qty,
    'manual', coalesce(p_note, p_movement_type), auth.uid()
  );

  insert into public.audit_logs (business_id, user_id, action, entity, entity_id, detail)
    values (v_business, auth.uid(), p_movement_type, 'ingredient', v_ing,
            jsonb_build_object('qty_change', p_qty, 'note', p_note));

  return jsonb_build_object('status', 'ok');
end;
$$;

-- ------------------------------------------------------------
-- REKONSILIASI STOK — cek konsistensi saldo vs jurnal.
-- Mengembalikan daftar bahan yang selisih saldo ≠ 0.
-- Perangkat offline tandem dapat membuat saldo global tidak konsisten.
-- ------------------------------------------------------------
create or replace function public.rpc_stock_reconcile()
returns table (
  ingredient_id uuid,
  ingredient_name text,
  balance_qty numeric,
  journal_qty numeric,
  diff numeric
)
language sql
security invoker
set search_path = public
as $$
  with biz as (select business_id from public.profiles where id = auth.uid()),
  bal as (
    select sb.ingredient_id, sb.qty
    from public.stock_balances sb join biz on sb.business_id = biz.business_id
  ),
  jr as (
    select sm.ingredient_id, sum(sm.qty_change) qty
    from public.stock_movements sm join biz on sm.business_id = biz.business_id
    group by sm.ingredient_id
  )
  select i.id, i.name,
         coalesce(b.qty, 0), coalesce(j.qty, 0),
         round(coalesce(b.qty, 0) - coalesce(j.qty, 0), 4)
  from public.ingredients i
  join biz on i.business_id = biz.business_id
  left join bal b on b.ingredient_id = i.id
  left join jr j on j.ingredient_id = i.id
  where coalesce(b.qty, 0) <> coalesce(j.qty, 0)
  order by i.name;
$$;
