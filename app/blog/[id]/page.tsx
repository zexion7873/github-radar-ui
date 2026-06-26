import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchBlog } from "@/lib/data";
import { TABLES } from "@/lib/config";
import { Badge, DataError, formatWeek } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await fetchBlog(TABLES.blog);
  if (!result.ok) return <DataError error={result.error} />;

  const post = result.rows.find((r) => r.id === id);
  if (!post) notFound();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/blog"
        className="font-mono text-[11px] tracking-wide text-muted uppercase transition-colors hover:text-foreground"
      >
        ← Blog
      </Link>

      <header className="flex flex-col gap-2">
        <a
          href={post.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="font-serif text-2xl break-words text-foreground transition-colors hover:text-accent"
        >
          {post.title} ↗
        </a>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-wide text-muted uppercase">
          {post.source && <Badge tone="muted">{post.source}</Badge>}
          {post.author && <span>{post.author}</span>}
          {post.published && <span>{formatWeek(post.published)}</span>}
        </div>
      </header>

      {post.brief && (
        <p className="text-sm leading-relaxed text-muted">
          {post.brief}
        </p>
      )}
      {post.summary && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-lg">摘要</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground">
            {post.summary}
          </p>
        </section>
      )}
      {post.comment && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-lg">點評</h2>
          <p className="border-l-2 border-border pl-3 text-sm leading-relaxed whitespace-pre-line text-muted italic">
            {post.comment}
          </p>
        </section>
      )}
    </div>
  );
}
