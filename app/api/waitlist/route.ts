import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email ?? "").trim().toLowerCase();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!EMAIL.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const supabase = getSupabase();
  if (!supabase) {
    // Not configured yet (e.g. local dev without .env.local): keep the form usable.
    console.warn("[waitlist] Supabase env vars missing; signup not stored:", email);
    return NextResponse.json({ ok: true, stored: false });
  }

  const { error } = await supabase.from("waitlist").insert({ email, source: "landing" });

  // 23505 = unique violation: they're already on the list, which is fine.
  if (error && error.code !== "23505") {
    console.error("[waitlist] insert failed:", error.code, error.message);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
