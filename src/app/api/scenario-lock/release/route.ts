import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/data/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * F64: Gibt die Szenariosperre beim Schließen des Tabs frei (navigator.sendBeacon).
 * Die Datenbankfunktion prüft Anmeldung, Projektzugang und dass die Sperre dem Aufrufer gehört.
 */
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin)
    return NextResponse.json({ error: "Ungültiger Ursprung" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (
    ![body?.projectId, body?.scenarioId, body?.token].every(
      (v) => typeof v === "string" && uuid.test(v),
    )
  )
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  const client = await serverClient();
  const { error } = await client.rpc("release_scenario_lock", {
    p_project_id: body.projectId,
    p_scenario_id: body.scenarioId,
    p_token: body.token,
  });
  if (error)
    return NextResponse.json(
      { error: "Freigabe nicht möglich" },
      { status: error.code === "42501" ? 403 : 400 },
    );
  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
