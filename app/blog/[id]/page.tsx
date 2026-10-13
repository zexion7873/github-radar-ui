import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchBlog } from "@/lib/data";
import { TABLES } from "@/lib/config";
import { Badge, DataError, formatWeek } from "@/components/ui";
import { splitSummary } from "@/lib/summary";

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

  // Letters only: a leading 「 makes ::first-letter swallow the quote and the
  // next glyph into one blob.
  const briefDropCap = !!post.brief && /^\s*\p{L}/u.test(post.brief);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
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
        <p
          className={`font-serif-text text-[1.0625rem] leading-[1.8] text-foreground ${
            briefDropCap
              ? "first-letter:float-left first-letter:mr-3 first-letter:font-serif first-letter:text-6xl first-letter:leading-[0.7] first-letter:text-accent"
              : ""
          }`}
        >
          {post.brief}
        </p>
      )}
      {post.summary && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">摘要</h2>
          <div className="flex flex-col gap-8 font-serif-text text-[1.0625rem] leading-[1.8] text-foreground">
            {splitSummary(post.summary).map((block, i) =>
              block.label ? (
                // Weight carries the level: mono and uppercase are no-ops on 漢字. The
                // negative margin binds the label to the cluster below it.
                <h3 key={i} className="-mb-4 font-semibold">
                  {block.text}
                </h3>
              ) : (
                <p key={i} className="whitespace-pre-line">
                  {block.text}
                </p>
              ),
            )}
          </div>
        </section>
      )}
      {post.comment && (
        <section className="flex flex-col gap-2">
          <h2 className="font-serif text-xl">點評</h2>
          <p className="border-l-[3px] border-accent pl-4 font-serif-text italic text-lg leading-relaxed whitespace-pre-line text-foreground">
            {post.comment}
          </p>
        </section>
      )}
    </div>
  );
}
