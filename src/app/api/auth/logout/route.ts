import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { serverClient } from "@/data/supabase/server";
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Ungültiger Ursprung" }, { status: 403 });
  const client = await serverClient();
  const { data } = await client.auth.getUser();
  if (data.user) {
    const { error } = await client.rpc("end_project_session");
    if (error)
      return NextResponse.json(
        { error: "Abmeldung fehlgeschlagen" },
        { status: 503 },
      );
  }
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error)
    return NextResponse.json(
      { error: "Abmeldung fehlgeschlagen" },
      { status: 503 },
    );
  (await cookies()).delete("neonex-project");
  return NextResponse.json({ ok: true });
}
