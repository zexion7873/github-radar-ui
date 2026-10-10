import type { Metadata } from "next";
import AskRadar from "@/components/AskRadar";

export const metadata: Metadata = {
  description:
    "Ask the GitHub Radar archive a question, in Chinese or English, and get an answer cited to the trending repos and blog posts it used.",
};

export default function Page() {
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

      <AskRadar />

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
