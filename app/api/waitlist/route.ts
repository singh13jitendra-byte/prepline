import { NextResponse } from "next/server";

// Waitlist endpoint. For the beta, swap the console.log for a Supabase insert, e.g.:
//
//   import { createClient } from "@supabase/supabase-js";
//   const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
//   await supabase.from("waitlist").insert({ email });
//
// Keep the service-role key server-side only (Vercel env vars), never in client code.

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

  console.log("[waitlist] new signup:", email);
  return NextResponse.json({ ok: true });
}
