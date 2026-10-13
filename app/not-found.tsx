import Link from "next/link";
import { Notice } from "@/components/ui";

// A stale detail id still answers 200 (loading.tsx already flushed it); Next's
// noindex meta keeps it out of search results.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <Link
        href="/"
        className="font-mono text-[11px] tracking-wide text-muted uppercase transition-colors hover:text-foreground"
      >
        ← Dashboard
      </Link>
      <Notice title="找不到這個頁面">
        <p>連結可能已失效，或這筆封存已不在 Notion 表裡。</p>
      </Notice>
    </div>
  );
}
