import type { Metadata } from "next";
import { setTimeout as sleep } from "node:timers/promises";
import AskRadar from "@/components/AskRadar";
import { askExamples, fetchBlog, fetchTrending } from "@/lib/data";
import { TABLES } from "@/lib/config";

export const metadata: Metadata = {
  description:
    "Ask the GitHub Radar archive a question, in Chinese or English, and get an answer cited to the trending repos and blog posts it used.",
};

export const dynamic = "force-dynamic";

// Tops up askExamples() when Notion is down or slow, or the archive is too young;
// /ask must keep working without Notion, since only radar-rag answers the question.
const FALLBACK_EXAMPLES = [
  "有哪些工具能讓 agent 記住跨對話的事情？",
  "最近有哪些談 prompt injection 的文章？",
  "Which trending repos help coding agents use skills?",
];

// A cold read cache waits on Notion, whose fetch has no timeout of its own.
const EXAMPLES_TIMEOUT_MS = 3000;

export default async function Page() {
  const [trending, blog] = (await Promise.race([
    Promise.all([fetchTrending(TABLES.trending), fetchBlog(TABLES.blog)]),
    sleep(EXAMPLES_TIMEOUT_MS, null, { ref: false }),
  ])) ?? [null, null];
  const examples = askExamples(
    trending?.ok ? trending.rows : [],
    blog?.ok ? blog.rows : [],
    new Date(),
  );
  for (const ex of FALLBACK_EXAMPLES) {
    if (examples.length < 3) examples.push(ex);
  }
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h2 className="font-serif text-3xl tracking-tight">Ask the radar</h2>
        <p className="font-serif-text text-[1.0625rem] leading-[1.8] text-foreground">
          用中文或英文問 GitHub Radar 的存檔，答案只根據每週的 trending repo 和部落格文章，並附上出處。
        </p>
        <p className="font-serif-text text-base leading-relaxed text-muted">
          Ask the GitHub Radar archive in Chinese or English. Answers come only from its weekly
          trending repos and blog posts, with citations.
        </p>
      </header>

      <AskRadar examples={examples} />

      <footer className="border-t border-border pt-4 text-sm text-muted">
        <p>
          每人每分鐘 5 題、每天 20 題。問題與回答會記錄在追蹤服務中，詳見{" "}
          <a
            href="https://github.com/zexion7873/radar-rag/blob/main/PRIVACY.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-foreground"
          >
            PRIVACY
          </a>
          。
        </p>
      </footer>
    </div>
  );
}
