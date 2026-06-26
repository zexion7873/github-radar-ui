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
        className="text-sm text-blue-600 hover:underline dark:text-blue-400"
      >
        ← Blog
      </Link>

      <header className="flex flex-col gap-2">
        <a
          href={post.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xl font-semibold break-words text-blue-600 hover:underline dark:text-blue-400"
        >
          {post.title} ↗
        </a>
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
          {post.source && <Badge tone="blue">{post.source}</Badge>}
          {post.author && <span>{post.author}</span>}
          {post.published && <span>{formatWeek(post.published)}</span>}
        </div>
      </header>

      {post.summary && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">摘要</h2>
          <p className="text-sm leading-relaxed whitespace-pre-line text-zinc-700 dark:text-zinc-300">
            {post.summary}
          </p>
        </section>
      )}
      {post.comment && (
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold">點評</h2>
          <p className="border-l-2 border-zinc-200 pl-3 text-sm leading-relaxed whitespace-pre-line text-zinc-600 italic dark:border-zinc-700 dark:text-zinc-400">
            {post.comment}
          </p>
        </section>
      )}
    </div>
  );
}
