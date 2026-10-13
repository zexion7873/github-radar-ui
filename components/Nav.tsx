"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_LOOT_TARGET } from "@/lib/config";

// One Loot tab for every target; the loot pages switch targets with a chip row.
const links: { href: string; label: string; prefix?: string; gated?: boolean }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/trending", label: "Trending" },
  { href: "/blog", label: "Blog" },
  { href: `/loot/${DEFAULT_LOOT_TARGET}`, label: "Loot", prefix: "/loot", gated: true },
  { href: "/ask", label: "Ask" },
];

export default function Nav({ authed }: { authed: boolean }) {
  const pathname = usePathname();
  // Logged out, proxy.ts bounces /loot/* to /login, so a gated tab would only be a login wall.
  const visible = links.filter((l) => authed || !l.gated);
  return (
    <nav aria-label="主要導覽" className="-mx-1 flex gap-4 overflow-x-auto px-1">
      {visible.map((l) => {
        // Loot matches any target's URL, not just the default it links to.
        const active = l.prefix
          ? pathname.startsWith(l.prefix)
          : pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-1 pb-1.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${
              active
                ? "border-accent text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
