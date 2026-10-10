"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DEFAULT_LOOT_TARGET, RADAR_RAG_URL } from "@/lib/config";

// A per-target tab repeated "LOOT ·" once per LOOT_TARGETS entry — fine at
// two targets, clumsy and unbounded at three-plus (and mobile just clips it
// off overflow-x-auto). "Loot" is now a single tab that lands on the default
// target; switching between targets happens on the loot pages themselves via
// a Chip row (app/loot/[target]/page.tsx) — the same pattern already used for
// every other filter in this app.
const links: {
  href: string;
  label: string;
  prefix?: string;
  gated?: boolean;
  external?: string;
  hint?: string;
}[] = [
  { href: "/", label: "Dashboard" },
  { href: "/trending", label: "Trending" },
  { href: "/blog", label: "Blog" },
  { href: `/loot/${DEFAULT_LOOT_TARGET}`, label: "Loot", prefix: "/loot", gated: true },
  // External: another service, so a new tab and no active state. `external` is
  // its accessible name, which says so (the ↗ alone reads as "arrow"). radar-rag
  // scales to zero and its JVM serves the page too, so a cold visit shows a blank
  // tab for ~10-15 s; `hint` warns before the click instead of after it.
  {
    href: RADAR_RAG_URL,
    label: "Ask ↗",
    external: "Ask the radar（在新分頁開啟 radar-rag，首次開啟約需 10–15 秒）",
    hint: "首次開啟約需 10–15 秒",
  },
];

export default function Nav({ authed }: { authed: boolean }) {
  const pathname = usePathname();
  // Logged out, proxy.ts bounces /loot/* to /login, so a gated tab would only be a login wall.
  const visible = links.filter((l) => authed || !l.gated);
  return (
    <nav aria-label="主要導覽" className="-mx-1 flex gap-4 overflow-x-auto px-1">
      {visible.map((l) => {
        // "Loot" matches any target's URL (/loot/copilot, a detail page, …),
        // not just the default one it links to — everything else keeps the
        // exact match it already had.
        const active = l.prefix
          ? pathname.startsWith(l.prefix)
          : pathname === l.href;
        const className = `-mb-px whitespace-nowrap border-b-2 px-1 pb-1.5 font-mono text-[11px] tracking-[0.14em] uppercase transition-colors ${
          active
            ? "border-accent text-foreground"
            : "border-transparent text-muted hover:text-foreground"
        }`;
        if (l.external) {
          return (
            <a
              key={l.href}
              href={l.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={l.external}
              title={l.hint}
              className={className}
            >
              {l.label}
            </a>
          );
        }
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={className}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
