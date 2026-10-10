"use client";
import { type SubmitEvent, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import Script from "next/script";
import { PRODUCTION_HOST, RADAR_RAG_URL, TURNSTILE_SITE_KEY } from "@/lib/config";
import {
  type AskResponse,
  type AskRow,
  type Inline,
  askErrorMessage,
  isAskResponse,
  isHttp,
  parseAnswer,
  rowHref,
  rowLabel,
  joinPassages,
  uncitedSources,
} from "@/lib/answer";
import { Notice, formatWeek } from "@/components/ui";

type Turnstile = {
  render: (
    el: HTMLElement,
    opts: {
      sitekey: string;
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
};

declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const EXAMPLES = [
  "有哪些工具能讓 agent 記住跨對話的事情？",
  "最近有哪些談 prompt injection 的文章？",
  "Which trending repos help coding agents use skills?",
];

// radar-rag scales to zero: a cold ask waits ~10-15 s for the service, then
// 5-10 s for the model. The timeout sits well past both.
const ASK_TIMEOUT_MS = 45_000;

// Only production and local dev can ask: radar-rag's CORS and the Turnstile
// widget allow no preview host. null during SSR, before the host is known.
const subscribeNoop = () => () => {};
function useAskAvailable(): boolean | null {
  const host = useSyncExternalStore(
    subscribeNoop,
    () => window.location.hostname,
    () => null,
  );
  if (host === null) return null;
  return host === PRODUCTION_HOST || host === "localhost" || host === "127.0.0.1";
}

export default function AskRadar() {
  const available = useAskAvailable();
  const [q, setQ] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<AskResponse | null>(null);
  const widgetEl = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const answerHeading = useRef<HTMLHeadingElement>(null);
  const form = useRef<HTMLFormElement>(null);

  // Wake radar-rag while the visitor types. An opaque no-cors GET needs no CORS
  // rule, and radar-rag leaves /config out of its rate limit.
  useEffect(() => {
    if (!available) return;
    // Warm-up only: if it fails, the real ask reports the error.
    fetch(`${RADAR_RAG_URL}/config`, { mode: "no-cors" }).catch(() => {});
  }, [available]);

  const renderWidget = useCallback(() => {
    if (!window.turnstile || !widgetEl.current || widgetId.current) return;
    widgetId.current = window.turnstile.render(widgetEl.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (t) => setToken(t),
      "expired-callback": () => setToken(null),
      "error-callback": () => {
        setToken(null);
        // Also fires when Cloudflare judges the browser automated (600xxx), where a reload rarely helps.
        setStatus(
          "機器人驗證沒有通過，請重新整理，或換一個瀏覽器試試。 · The bot check did not pass; reload, or try another browser.",
        );
      },
    });
  }, []);

  useEffect(
    () => () => {
      if (widgetId.current) window.turnstile?.remove(widgetId.current);
      widgetId.current = null;
    },
    [],
  );

  // A fresh answer lands below the form: bring it into view and move focus to its
  // heading, so keyboard and screen-reader users start reading there.
  useEffect(() => {
    if (!result) return;
    answerHeading.current?.focus({ preventScroll: true });
    answerHeading.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [result]);

  const ask = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const question = q.trim();
    if (!question || !token || pending) return;
    const used = token;
    setToken(null);
    setPending(true);
    setResult(null);
    setStatus(
      "思考中。第一次提問要先喚醒服務，約 10 到 15 秒，回答再 5 到 10 秒…… · Thinking. A first question wakes the service (10-15 s), then the model answers (5-10 s)…",
    );
    try {
      const res = await fetch(`${RADAR_RAG_URL}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Turnstile-Token": used },
        body: JSON.stringify({ q: question }),
        signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
      });
      if (!res.ok) {
        setStatus(askErrorMessage(res.status));
        return;
      }
      const data: unknown = await res.json();
      if (!isAskResponse(data)) {
        setStatus("回答的格式不對，請稍後再試。 · The answer came back malformed.");
        return;
      }
      setResult(data);
      setStatus("");
    } catch (err) {
      setStatus(
        err instanceof DOMException && err.name === "TimeoutError"
          ? "等太久了，服務可能還在啟動，請再試一次。 · Timed out; the service may still be starting. Try again."
          : "連線失敗，請再試一次。 · The request failed; try again.",
      );
    } finally {
      setPending(false);
      // Each token verifies once, so the next question needs a fresh one.
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    }
  };

  if (available === false) {
    return (
      <Notice title="預覽環境不提供提問 · Not available on previews">
        <p>
          radar-rag 只接受正式網站的請求。請到{" "}
          <a href={`https://${PRODUCTION_HOST}/ask`} className="underline">
            {PRODUCTION_HOST}/ask
          </a>{" "}
          提問。
        </p>
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {available && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onReady={renderWidget}
        />
      )}

      <form ref={form} onSubmit={ask} className="flex flex-col gap-3">
        <label htmlFor="q" className="font-mono text-[11px] tracking-wide text-muted uppercase">
          你的問題 · Your question
        </label>
        <textarea
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              form.current?.requestSubmit();
            }
          }}
          aria-describedby="q-hint"
          rows={3}
          maxLength={500}
          required
          placeholder="例如：有哪些工具能讓 agent 記住跨對話的事情？"
          className="w-full rounded-none border border-border bg-surface px-3 py-2 font-serif-text text-base leading-relaxed placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
        />
        <div className="flex flex-wrap gap-2" aria-label="範例問題 · Examples">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setQ(ex)}
              className="rounded-none border border-border px-3 py-1 text-left text-sm text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:outline-none"
            >
              {ex}
            </button>
          ))}
        </div>
        <div ref={widgetEl} className="min-h-[65px]" />
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-2">
          <button
            type="submit"
            disabled={!token || !q.trim() || pending}
            className="rounded-none border border-foreground bg-foreground px-4 py-1.5 font-mono text-[11px] tracking-[0.14em] text-background uppercase transition-colors hover:border-accent hover:bg-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted"
          >
            {pending ? "思考中 · Thinking" : "提問 · Ask"}
          </button>
          <span id="q-hint" className="font-mono text-[11px] tracking-wide text-muted">
            {pending ? "" : !token ? "正在做機器人驗證… · Verifying you're human…" : "⌘ / Ctrl + Enter"}
          </span>
        </div>
      </form>

      <p role="status" aria-live="polite" className="text-sm text-muted empty:hidden">
        {status}
      </p>

      {result && <Answer data={result} headingRef={answerHeading} />}
    </div>
  );
}

function InlineText({ parts }: { parts: Inline[] }) {
  return parts.map((p, i) =>
    p.kind === "strong" ? (
      <strong key={i}>{p.text}</strong>
    ) : p.kind === "code" ? (
      <code key={i} className="font-mono text-[0.9em]">
        {p.text}
      </code>
    ) : (
      p.text
    ),
  );
}

// Section heads follow the site's dialect: an accent tick for a section front, and
// for a fold the BlogList group head (rotating ›, tick, label, mono count).
function Tick() {
  return (
    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 shrink-0 self-center bg-accent" />
  );
}

function FoldHead({
  group,
  label,
  count,
  size,
}: {
  group: "cited" | "others";
  label: string;
  count: number;
  size: "xl" | "lg";
}) {
  return (
    <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <h2
        className={`flex items-baseline gap-2 font-serif tracking-tight text-foreground transition-colors hover:text-accent ${
          size === "xl" ? "text-xl" : "text-lg"
        }`}
      >
        <span
          aria-hidden="true"
          className={`self-center font-mono text-xs text-muted transition-transform ${
            group === "cited" ? "group-open/cited:rotate-90" : "group-open/others:rotate-90"
          }`}
        >
          &rsaquo;
        </span>
        <Tick />
        {label}
        <span className="font-mono text-xs font-normal tracking-wide text-muted">{count}</span>
      </h2>
    </summary>
  );
}

function Answer({
  data,
  headingRef,
}: {
  data: AskResponse;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
}) {
  const others = uncitedSources(data);
  const blocks = parseAnswer(data.answer);
  return (
    <section className="flex flex-col gap-8 border-t-2 border-foreground pt-6">
      <div className="flex flex-col gap-4">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="flex items-center gap-2.5 font-serif text-xl tracking-tight focus:outline-none"
        >
          <Tick />
          回答 · Answer
        </h2>
        <div className="flex flex-col gap-4 font-serif-text text-[1.0625rem] leading-[1.8] text-foreground">
          {blocks.map((b, i) =>
            b.kind === "ul" ? (
              <ul key={i} className="flex list-disc flex-col gap-2 pl-5 marker:text-muted">
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    <InlineText parts={item} />
                  </li>
                ))}
              </ul>
            ) : b.kind === "h3" ? (
              // Weight, not mono or uppercase, carries the level: both are no-ops on 漢字.
              <h3 key={i} className="mt-2 border-l-2 border-accent pl-3 font-semibold leading-snug">
                <InlineText parts={b.inline} />
              </h3>
            ) : (
              // The opening paragraph reads as the deck: one step up, like a lede.
              <p key={i} className={i === 0 ? "text-lg leading-[1.7]" : undefined}>
                <InlineText parts={b.inline} />
              </p>
            ),
          )}
        </div>
      </div>

      {/* The answer already restates what it cites, so the citations start folded:
          the evidence is one click away instead of reading as the answer twice. */}
      {data.citations.length > 0 && (
        <details className="group/cited">
          <FoldHead group="cited" label="引用 · Cited" count={data.citations.length} size="xl" />
          <div className="mt-3">
            <Rows rows={data.citations} variant="cited" />
          </div>
        </details>
      )}

      {others.length > 0 && (
        <details className="group/others">
          <FoldHead
            group="others"
            label="其他檢索到、但沒有引用的資料 · Also retrieved"
            count={others.length}
            size="lg"
          />
          <div className="mt-3">
            <Rows rows={others} variant="compact" />
          </div>
        </details>
      )}

      <p className="font-mono text-[11px] tracking-wide text-muted">
        {data.usage.model} · {data.usage.inputTokens} in / {data.usage.outputTokens} out tokens
      </p>
    </section>
  );
}

// "cited" is the evidence: numbered, full-size titles, passages. "compact" is the
// rows retrieved but unused: a lighter, tighter list one step below it.
function Rows({ rows, variant }: { rows: AskRow[]; variant: "cited" | "compact" }) {
  const cited = variant === "cited";
  const title = cited
    ? "font-serif text-lg break-all text-foreground transition-colors hover:text-accent"
    : "font-serif text-base break-all text-muted transition-colors hover:text-foreground";
  return (
    <ol className={cited ? "flex flex-col divide-y divide-border" : "flex flex-col gap-1.5"}>
      {rows.map((row, i) => {
        const target = rowHref(row);
        const name = rowLabel(row);
        const passage = cited ? joinPassages(row.citedText ?? [], name) : "";
        return (
          <li key={`${row.id}-${i}`} className={cited ? "flex flex-col gap-2 py-3" : "flex flex-col"}>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {cited && (
                <span className="font-mono text-[11px] tracking-[0.18em] text-muted tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
              )}
              {target?.internal ? (
                <Link href={target.href} className={title}>
                  {name}
                </Link>
              ) : target ? (
                <a
                  href={target.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={title}
                >
                  {name} ↗
                </a>
              ) : (
                <span className={title}>{name}</span>
              )}
              <span className="font-mono text-[11px] tracking-wide text-muted uppercase">
                {row.source === "blog" ? "blog" : "trending"}
                {row.week && ` · ${formatWeek(row.week)}`}
                {target?.internal && isHttp(row.url) && (
                  <>
                    {" · "}
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-foreground"
                    >
                      {row.source === "blog" ? "原文 ↗" : "GitHub ↗"}
                    </a>
                  </>
                )}
              </span>
            </div>
            {passage && (
              <blockquote className="border-l-2 border-accent pl-3 font-serif-text text-sm leading-relaxed text-muted">
                {passage}
              </blockquote>
            )}
          </li>
        );
      })}
    </ol>
  );
}
