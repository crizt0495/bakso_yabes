import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import { SyncBoot } from "@/features/sync/use-sync-status";

/** Layout dashboard terlindungi — middleware sudah menjaga sesi. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // nama profil & bisnis untuk tampilan shell
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, businesses(name)")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell
      userName={profile?.full_name ?? "Pemilik"}
      businessName={(profile as unknown as { businesses?: { name?: string } | Array<{ name?: string }> })?.businesses
        ? Array.isArray((profile as unknown as { businesses: Array<{ name?: string }> }).businesses)
          ? ((profile as unknown as { businesses: Array<{ name?: string }> }).businesses[0]?.name ?? "Warung")
          : ((profile as unknown as { businesses: { name?: string } }).businesses?.name ?? "Warung")
        : "Warung"}
    >
      <SyncBoot />
      {children}
    </AppShell>
  );
}
