import { supabaseServer } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST() {
  const serverClient = await supabaseServer();
  const { error } = await serverClient.auth.signOut();
  if (error) {
    return NextResponse.json({ error: "Gagal logout" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
