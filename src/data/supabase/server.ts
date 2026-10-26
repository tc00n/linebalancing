import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { supabaseConfig } from "./config";
export async function serverClient() {
  // SDK-Zeitpruefungen erst fuer die echte Anfrage ausfuehren, nie beim Prefetch-Prerendern.
  await connection();
  const store = await cookies();
  const { url, key } = supabaseConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        // In Server Components uebernimmt Proxy das Schreiben der Cookies.
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* read-only rendering */
        }
      },
    },
  });
}
