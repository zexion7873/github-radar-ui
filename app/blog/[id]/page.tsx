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

  // Drop cap whenever the brief opens with a letter — Latin or CJK both flatter a
  // large first character. The case it can't survive is leading punctuation: a
  // full-width quote (「) makes ::first-letter swallow the quote + next glyph into
  // one mushy blob, so those are gated out (\p{L} matches letters incl. 漢字 but
  // excludes punctuation / quotes / digits).
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
          <p className="font-serif-text text-[1.0625rem] leading-[1.8] whitespace-pre-line text-foreground">
            {post.summary}
          </p>
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
