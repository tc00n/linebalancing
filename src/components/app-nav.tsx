"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  {
    href: "/",
    label: "Szenarien",
    active: (path: string) => path === "/" || path.startsWith("/szenario"),
  },
  {
    href: "/personalplanung",
    label: "Personalplanung",
    active: (path: string) => path.startsWith("/personalplanung"),
  },
] as const;

/**
 * U12: eine Navigation in der Kopfzeile für alle Seiten statt eigener Rückwege je Seite.
 * Die aktive Seite ist markiert; Import und Tabelle gehören zu „Szenarien“.
 */
export function AppNav() {
  const path = usePathname();
  return (
    <nav aria-label="Hauptnavigation" className="flex items-center gap-1">
      {ITEMS.map((item) => {
        const active =
          item.active(path) || (item.href === "/" && path === "/import");
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-secondary text-nx-blue"
                : "text-muted-foreground hover:bg-muted hover:text-nx-blue"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
