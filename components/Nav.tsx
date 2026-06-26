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
    <nav aria-label="主要導覽" className="-mx-1 flex gap-1 overflow-x-auto px-1">
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-zinc-900 text-white dark:bg-white dark:text-black"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
