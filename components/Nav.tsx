"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_LOOT_TARGET } from "@/lib/config";

// A per-target tab repeated "LOOT ·" once per LOOT_TARGETS entry — fine at
// two targets, clumsy and unbounded at three-plus (and mobile just clips it
// off overflow-x-auto). "Loot" is now a single tab that lands on the default
// target; switching between targets happens on the loot pages themselves via
// a Chip row (app/loot/[target]/page.tsx) — the same pattern already used for
// every other filter in this app.
const links: { href: string; label: string; prefix?: string }[] = [
  { href: "/", label: "Dashboard" },
  { href: "/trending", label: "Trending" },
  { href: "/blog", label: "Blog" },
  { href: `/loot/${DEFAULT_LOOT_TARGET}`, label: "Loot", prefix: "/loot" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="主要導覽" className="-mx-1 flex gap-4 overflow-x-auto px-1">
      {links.map((l) => {
        // "Loot" matches any target's URL (/loot/copilot, a detail page, …),
        // not just the default one it links to — everything else keeps the
        // exact match it already had.
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
