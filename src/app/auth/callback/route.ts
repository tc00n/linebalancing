import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/data/supabase/server";
import { safeNext } from "@/features/auth/safe-next";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const client = await serverClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          safeNext(request.nextUrl.searchParams.get("next")),
          request.url,
        ),
      );
  }
  return NextResponse.redirect(new URL("/login?fehler=callback", request.url));
}
