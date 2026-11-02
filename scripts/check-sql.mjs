import fs from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "supabase", "migrations");
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (files.length < 3) {
  console.error("Expected at least 3 migration files in", dir);
  process.exit(1);
}

const required = ["businesses", "profiles", "sales", "sale_items", "stock_movements", "ingredients", "recipes", "idempotency_keys", "audit_logs"];
for (const f of files) {
  const sql = fs.readFileSync(path.join(dir, f), "utf8");
  // sanity: no service_role secret leaked
  if (/SUPABASE_SERVICE_ROLE_KEY/.test(sql)) {
    console.error("Secret leak in", f);
    process.exit(1);
  }
}
const all = files.map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
for (const t of required) {
  if (!new RegExp(`create table public\\.${t}\\b`).test(all)) {
    console.error(`Missing table: ${t}`);
    process.exit(1);
  }
}
console.log(`OK: ${files.length} migrations, ${required.length} required tables present.`);
