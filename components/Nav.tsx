"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/trending", label: "Trending" },
  { href: "/blog", label: "Blog" },
  { href: "/loot/claude", label: "Loot · Claude" },
  { href: "/loot/copilot", label: "Loot · Copilot" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav aria-label="主要導覽" className="-mx-1 flex gap-4 overflow-x-auto px-1">
      {links.map((l) => {
        const active = pathname === l.href;
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
