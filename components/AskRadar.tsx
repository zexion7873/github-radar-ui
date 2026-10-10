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

      <form onSubmit={ask} className="flex flex-col gap-3">
        <label htmlFor="q" className="font-mono text-[11px] tracking-wide text-muted uppercase">
          你的問題 · Your question
        </label>
        <textarea
          id="q"
          value={q}
          onChange={(e) => setQ(e.target.value)}
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
        <button
          type="submit"
          disabled={!token || !q.trim() || pending}
          className="self-start rounded-none border border-foreground bg-foreground px-4 py-1.5 font-mono text-[11px] tracking-[0.14em] text-background uppercase transition-colors hover:border-accent hover:bg-accent disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-muted"
        >
          {pending ? "思考中 · Thinking" : "提問 · Ask"}
        </button>
      </form>

      <p role="status" aria-live="polite" className="text-sm text-muted empty:hidden">
        {status}
      </p>

      {result && <Answer data={result} />}
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

function Answer({ data }: { data: AskResponse }) {
  return (
    <section className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="font-serif text-xl">回答 · Answer</h2>
        <div className="flex flex-col gap-3 font-serif-text text-[1.0625rem] leading-[1.8] text-foreground">
          {parseAnswer(data.answer).map((b, i) =>
            b.kind === "ul" ? (
              <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
                {b.items.map((item, j) => (
                  <li key={j}>
                    <InlineText parts={item} />
                  </li>
                ))}
              </ul>
            ) : b.kind === "h3" ? (
              <h3 key={i} className="font-semibold">
                <InlineText parts={b.inline} />
              </h3>
            ) : (
              <p key={i}>
                <InlineText parts={b.inline} />
              </p>
            ),
          )}
        </div>
      </div>

      {data.citations.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="font-serif text-xl">引用 · Cited</h2>
          <Rows rows={data.citations} withQuotes />
        </div>
      )}

      {data.sources.length > 0 && (
        <details className="group/sources">
          <summary className="cursor-pointer list-none font-mono text-[11px] tracking-wide text-muted uppercase transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
            <span className="inline-block transition-transform group-open/sources:rotate-90">›</span>{" "}
            檢索到的全部資料列 · All retrieved rows（{data.sources.length}）
          </summary>
          <div className="mt-3">
            <Rows rows={data.sources} withQuotes={false} />
          </div>
        </details>
      )}

      <p className="font-mono text-[11px] tracking-wide text-muted">
        {data.usage.model} · {data.usage.inputTokens} in / {data.usage.outputTokens} out tokens
      </p>
    </section>
  );
}

function Rows({ rows, withQuotes }: { rows: AskRow[]; withQuotes: boolean }) {
  return (
    <ol className="flex flex-col divide-y divide-border">
      {rows.map((row, i) => {
        const target = rowHref(row);
        const name = rowLabel(row);
        return (
          <li key={`${row.id}-${i}`} className="flex flex-col gap-2 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {target?.internal ? (
                <Link
                  href={target.href}
                  className="font-serif text-lg break-all text-foreground transition-colors hover:text-accent"
                >
                  {name}
                </Link>
              ) : target ? (
                <a
                  href={target.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-serif text-lg break-all text-foreground transition-colors hover:text-accent"
                >
                  {name} ↗
                </a>
              ) : (
                <span className="font-serif text-lg break-all">{name}</span>
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
            {withQuotes &&
              (row.citedText ?? []).map((quote, j) => (
                <blockquote
                  key={j}
                  className="border-l-2 border-accent pl-3 font-serif-text text-sm leading-relaxed text-muted"
                >
                  {quote}
                </blockquote>
              ))}
          </li>
        );
      })}
    </ol>
  );
}
