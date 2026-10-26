import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { serverClient } from "@/data/supabase/server";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Ungültiger Ursprung" }, { status: 403 });
  const client = await serverClient();
  const { data } = await client.auth.getUser();
  if (!data.user)
    return NextResponse.json(
      { error: "Anmeldung erforderlich" },
      { status: 401 },
    );
  const body = await request.json().catch(() => null);
  if (typeof body?.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id))
    return NextResponse.json({ error: "Ungültiges Projekt" }, { status: 400 });
  const { data: project } = await client
    .from("projects")
    .select("id")
    .eq("id", body.id)
    .maybeSingle();
  if (!project)
    return NextResponse.json({ error: "Kein Projektzugriff" }, { status: 403 });
  (await cookies()).set("neonex-project", project.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: request.nextUrl.protocol === "https:",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
