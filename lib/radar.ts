import "server-only";

// Client for the radar-rag service's /ask endpoint — the RAG endpoint that embeds
// the question, searches the shared pgvector store, and has Claude answer from the
// retrieved radar rows. This UI is otherwise a pure Notion reader; /ask is the one
// capability it delegates to the sibling service.

// A retrieved source row. `repo` is the trending/loot repo, or the post title for
// blog rows (which have no repo). Mirrors radar-rag's AskController.Citation.
export type AskCitation = {
  repo: string | null;
  url: string | null;
  week: string | null;
  score: number | null;
};

export type AskResult =
  | { ok: true; answer: string; citations: AskCitation[] }
  | { ok: false; error: string };

export const MAX_QUESTION_LEN = 500;

// LLM round-trip: generous, since /ask embeds the query, searches pgvector, and
// waits on a Claude completion. Past this the user gets a retry, not a hung tab.
const TIMEOUT_MS = 30_000;

// `base` is the radar-rag origin; the caller passes it from RADAR_INTEL_URL so this
// stays env-free and unit-testable. A trailing slash is tolerated.
export async function askRadar(base: string, question: string): Promise<AskResult> {
  const q = question.trim();
  if (!q) return { ok: false, error: "請輸入問題" };
  if (q.length > MAX_QUESTION_LEN) {
    return { ok: false, error: `問題請控制在 ${MAX_QUESTION_LEN} 字以內` };
  }

  let res: Response;
  try {
    res = await fetch(`${base.replace(/\/$/, "")}/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q }),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "TimeoutError";
    return {
      ok: false,
      error: timedOut ? "radar-rag 逾時，請稍後再試" : "無法連線 radar-rag",
    };
  }

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    // radar-rag's ApiErrorHandler surfaces the upstream cause in `message`.
    const message = (json as { message?: string } | null)?.message;
    return { ok: false, error: message ?? `radar-rag 錯誤 ${res.status}` };
  }

  // A 200 with an empty or non-JSON body (a truncated response, or an HTML 200 from
  // an intermediary) parses to null/no answer. Surface that as an error rather than a
  // blank "success" that leaves the box looking untouched.
  const body = (json ?? {}) as { answer?: string; citations?: AskCitation[] };
  if (!body.answer || !body.answer.trim()) {
    return { ok: false, error: "radar-rag 沒有回覆內容，請稍後再試" };
  }
  return { ok: true, answer: body.answer, citations: body.citations ?? [] };
}
