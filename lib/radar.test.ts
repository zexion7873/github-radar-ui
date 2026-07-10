import { afterEach, describe, expect, it, vi } from "vitest";
import { askRadar, MAX_QUESTION_LEN } from "./radar";

describe("askRadar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a blank question without calling the service", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(await askRadar("http://svc", "   ")).toEqual({
      ok: false,
      error: "請輸入問題",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects an over-long question", async () => {
    const res = await askRadar("http://svc", "x".repeat(MAX_QUESTION_LEN + 1));
    expect(res.ok).toBe(false);
  });

  it("maps a successful answer + citations and trims a trailing slash on base", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          answer: "hi",
          citations: [{ repo: "a/b", url: "u", week: "2026-06-20", score: 0.3 }],
        }),
        { status: 200 },
      ),
    );
    const res = await askRadar("http://svc/", "q");
    expect(spy).toHaveBeenCalledWith("http://svc/ask", expect.anything());
    expect(res).toEqual({
      ok: true,
      answer: "hi",
      citations: [{ repo: "a/b", url: "u", week: "2026-06-20", score: 0.3 }],
    });
  });

  it("treats a 200 with an empty/answerless body as an error, not a blank success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 200 }),
    );
    const res = await askRadar("http://svc", "q");
    expect(res.ok).toBe(false);
  });

  it("surfaces the upstream message on a non-2xx", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ message: "ANTHROPIC_API_KEY missing" }), {
        status: 502,
      }),
    );
    expect(await askRadar("http://svc", "q")).toEqual({
      ok: false,
      error: "ANTHROPIC_API_KEY missing",
    });
  });

  it("returns a transport error when fetch throws", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await askRadar("http://svc", "q")).toEqual({
      ok: false,
      error: "無法連線 radar-rag",
    });
  });

  it("returns a timeout error when the request aborts", async () => {
    const err = new Error("timed out");
    err.name = "TimeoutError";
    vi.spyOn(globalThis, "fetch").mockRejectedValue(err);
    expect(await askRadar("http://svc", "q")).toEqual({
      ok: false,
      error: "radar-rag 逾時，請稍後再試",
    });
  });
});
