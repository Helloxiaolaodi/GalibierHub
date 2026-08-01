import { NextResponse, type NextRequest } from "next/server";
import { getServiceSupabase, getSupabase, hasSupabaseServiceRole, isSupabaseConfigured } from "@/utils/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json({ exists: false });
  }

  let body: { email?: unknown };
  try {
    body = await request.json() as { email?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }

  try {
    if (hasSupabaseServiceRole) {
      const sb = getServiceSupabase();
      const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (!error && data) {
        const exists = data.users.some((user) => user.email?.toLowerCase() === email);
        return NextResponse.json({ exists });
      }
    }

    const { data: profile } = await getSupabase()
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    return NextResponse.json({ exists: Boolean(profile) });
  } catch {
    return NextResponse.json({ exists: false });
  }
}
