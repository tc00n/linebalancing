import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

export function AppHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white">
      <div className="flex h-14 items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/neonex-logo-blue.svg"
            alt="NEONEX"
            width={92}
            height={16}
            priority
          />
          <span className="h-5 w-px bg-border" aria-hidden />
          <span className="font-heading text-sm font-semibold tracking-wide">
            Line Balancing
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-2">{children}</div>
      </div>
    </header>
  );
}
