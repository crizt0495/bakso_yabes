/** Tipe data hasil query Supabase (numeric dikirim sebagai string). */

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  currency: string;
  timezone: string;
  qr_menu_code: string;
  qr_menu_enabled: boolean;
}

export interface Profile {
  id: string;
  business_id: string;
  username: string;
  full_name: string;
  role: string;
}

export interface Device {
  id: string;
  business_id: string;
  device_code: string;
  label: string | null;
  is_active: boolean;
  last_seen_at: string | null;
}

export interface Category {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  business_id: string;
  name: string;
  price: string | number;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Product {
  id: string;
  business_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  photo_url: string | null;
  price: string | number;
  is_available: boolean;
  is_active: boolean;
  sort_order: number;
  categories?: Pick<Category, "id" | "name"> | null;
  product_variants?: ProductVariant[];
}

export interface Unit {
  id: string;
  business_id: string;
  name: string;
  symbol: string;
}

export interface Ingredient {
  id: string;
  business_id: string;
  unit_id: string;
  name: string;
  minimum_stock: string | number;
  is_active: boolean;
  units?: Pick<Unit, "id" | "name" | "symbol"> | null;
  stock_balances?: { ingredient_id: string; qty: string | number; avg_cost: string | number } | null;
}

export interface RecipeItem {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  product_variant_id: string | null;
  qty: string | number;
  ingredients?: Ingredient;
}

export interface Recipe {
  id: string;
  product_id: string;
  name: string | null;
  note: string | null;
  is_active: boolean;
  recipe_items?: RecipeItem[];
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  qty: string | number;
  unit_price: string | number;
  line_total: string | number;
  note: string | null;
}

export interface Sale {
  id: string;
  receipt_no: string;
  idempotency_key: string;
  channel: string;
  order_type: string;
  table_id: string | null;
  customer_id: string | null;
  customer_name: string | null;
  subtotal: string | number;
  discount: string | number;
  total: string | number;
  paid_amount: string | number;
  change_amount: string | number;
  hpp_total: string | number;
  status: string;
  void_reason: string | null;
  refund_amount: string | number;
  device_id: string | null;
  occurred_at: string;
  synced_at: string | null;
  local_day: string | null;
  note: string | null;
  payments?: Payment[];
  sale_items?: SaleItem[];
}

export interface Payment {
  id: string;
  sale_id: string;
  method: string;
  amount: string | number;
  status: string;
  provider_ref: string | null;
  paid_at: string | null;
}

export interface StockMovement {
  id: string;
  business_id: string;
  ingredient_id: string;
  movement_type: string;
  qty_change: string | number;
  unit_cost: string | number | null;
  ref_type: string | null;
  ref_id: string | null;
  ref_note: string | null;
  occurred_at: string;
  ingredients?: { name: string; unit_id: string; units?: { symbol: string } | null };
}

export interface StockBalance {
  ingredient_id: string;
  business_id: string;
  qty: string | number;
  avg_cost: string | number;
}

export interface Supplier {
  id: string;
  business_id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
}

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  ingredient_id: string;
  qty: string | number;
  unit_cost: string | number;
  line_total: string | number;
  ingredients?: { name: string; units?: { symbol: string } | null };
}

export interface Purchase {
  id: string;
  business_id: string;
  supplier_id: string | null;
  ref_no: string;
  purchase_date: string;
  total: string | number;
  payment_status: string;
  status: string;
  note: string | null;
  receipt_url: string | null;
  suppliers?: Contractor | null;
  purchase_items?: PurchaseItem[];
}
export type Contractor = { id: string; name: string; phone: string | null };

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: string | number;
  spent_at: string;
}

export interface CashTransaction {
  id: string;
  direction: string;
  source: string;
  ref_type: string | null;
  ref_id: string | null;
  amount: string | number;
  note: string | null;
  occurred_at: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
}

export interface DigitalOrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_variant_id: string | null;
  product_name: string;
  variant_name: string | null;
  qty: string | number;
  unit_price: string | number;
  line_total: string | number;
}

export interface DigitalOrder {
  id: string;
  order_code: string;
  customer_name: string;
  order_type: string;
  table_no: string | null;
  status: string;
  note: string | null;
  total: string | number;
  created_at: string;
  digital_order_items?: DigitalOrderItem[];
}

export interface DiningTable {
  id: string;
  business_id: string;
  name: string;
  is_active: boolean;
}
