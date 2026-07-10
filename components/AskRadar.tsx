"use client";

import { useState, useTransition } from "react";
import { ask } from "@/app/ask/actions";
import type { AskCitation } from "@/lib/radar";
import { cardClass, Badge, formatWeek } from "./ui";

// The authed "問問雷達" box: natural-language Q&A over the whole radar, answered by
// the radar-rag RAG service with citations. Only rendered when the session is authed
// AND RADAR_INTEL_URL is set (see app/page.tsx) — it costs Claude tokens per ask.
export default function AskRadar() {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{
    answer: string;
    citations: AskCitation[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    const question = q.trim();
    if (!question || pending) return;
    start(async () => {
      setError(null);
      try {
        const res = await ask(question);
        if (res.ok) {
          setResult({ answer: res.answer, citations: res.citations });
        } else {
          setResult(null);
          setError(res.error);
        }
      } catch {
        setResult(null);
        setError("發生錯誤，請重新登入後再試");
      }
    });
  }

  const idle = pending || !q.trim();

  return (
    <section
      className={`${cardClass} flex flex-col gap-3 p-4`}
      aria-labelledby="ask-radar-title"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2
          id="ask-radar-title"
          className="font-serif text-xl tracking-tight text-foreground"
        >
          問問雷達
        </h2>
        <span className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
          RAG · Claude
        </span>
      </div>

      <textarea
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter is a newline — chat-box convention.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        aria-label="問題"
        placeholder="用自然語言問雷達上的趨勢、工具或文章⋯⋯（Enter 送出，Shift+Enter 換行）"
        className="w-full resize-y rounded-none border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus-visible:border-ink-2 focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none"
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          答案由 radar-rag 依檢索到的雷達資料生成，附引用出處。
        </p>
        <button
          type="button"
          onClick={submit}
          aria-disabled={idle}
          className={`shrink-0 rounded-none border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none ${
            idle
              ? "cursor-default border-border text-muted"
              : "cursor-pointer border-foreground bg-foreground text-background hover:bg-ink-2"
          }`}
        >
          {pending ? "思考中⋯" : "送出"}
        </button>
      </div>

      {error && (
        <p role="status" aria-live="polite" className="text-sm text-danger">
          {error}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
            {result.answer}
          </p>
          {result.citations.length > 0 && (
            <div className="flex flex-col gap-1 border-t border-border pt-2">
              <p className="font-mono text-[11px] tracking-[0.08em] text-muted uppercase">
                引用出處
              </p>
              <ul className="flex flex-col gap-1">
                {result.citations.map((c, i) => (
                  <li
                    key={`${c.url ?? c.repo ?? "cite"}-${i}`}
                    className="flex items-center gap-2 text-sm"
                  >
                    {c.url ? (
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-accent hover:underline"
                      >
                        {c.repo ?? c.url}
                      </a>
                    ) : (
                      <span className="truncate text-foreground">
                        {c.repo ?? "—"}
                      </span>
                    )}
                    {c.week && <Badge>{formatWeek(c.week)}</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
