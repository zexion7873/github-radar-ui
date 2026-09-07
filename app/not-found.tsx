import Link from "next/link";
import { Notice } from "@/components/ui";

// Catches both the notFound() calls in the dynamic detail pages and any unmatched
// URL. Only the unmatched URL gets a real 404 status — a stale detail id resolves
// after app/loading.tsx has already flushed a 200 (Next 16 loading.js "Status
// Codes"); the noindex meta Next emits is what keeps that out of search results.
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
