import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST { email } → one of
 *   200 { ok: true }                    stored
 *   200 { ok: true, duplicate: true }   already on the list (nothing written)
 *   200 { ok: true, stored: false }     Supabase is not configured (local dev): nothing written
 *   400 { error }                       not an email
 *   500 { error }                       the insert failed
 */
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

  // 23505 = unique violation: they are already on the list. Still a success, and the form says so
  // ("You're already on the list") instead of pretending it was a first request.
  // Note: this tells whoever submits an address that it is already signed up.
  if (error?.code === "23505") {
    return NextResponse.json({ ok: true, duplicate: true });
  }
  if (error) {
    console.error("[waitlist] insert failed:", error.code, error.message);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
