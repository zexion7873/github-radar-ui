import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// setLootStatus is the ONLY code path that writes to Notion, so its guards are
// the highest-risk logic in the repo. Mock the framework edges (next/headers,
// next/cache) and the Notion I/O so what's under test is the action's own
// pipeline: session check → status whitelist → loot-page allow-list → write +
// cache bust.
const { cookieJar, updateSelect, fetchLoot, updateTag } = vi.hoisted(() => ({
  cookieJar: { value: undefined as string | undefined },
  updateSelect: vi.fn(),
  fetchLoot: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () =>
      cookieJar.value === undefined ? undefined : { value: cookieJar.value },
  }),
}));

// lib/data (loaded for real below) imports unstable_cache at module scope, so
// the mock must provide it even though these tests never exercise caching.
vi.mock("next/cache", () => ({
  unstable_cache: (fn: unknown) => fn,
  updateTag,
}));

vi.mock("@/lib/notion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/notion")>()),
  updateSelect,
}));

vi.mock("@/lib/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data")>()),
  fetchLoot,
}));

import { setLootStatus } from "./actions";
import { createSessionToken } from "@/lib/auth";
import { LOOT_TARGETS } from "@/lib/config";

const okRows = (ids: string[]) => ({
  ok: true,
  rows: ids.map((id) => ({ id })),
});

describe("setLootStatus", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret";
    cookieJar.value = createSessionToken();
    fetchLoot.mockResolvedValue(okRows(["page-1"]));
    updateSelect.mockResolvedValue(undefined);
  });
  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.AUTH_SECRET;
  });

  it("rejects when there is no session cookie", async () => {
    cookieJar.value = undefined;
    await expect(setLootStatus("page-1", "adopted")).rejects.toThrow(
      "unauthorized",
    );
    expect(updateSelect).not.toHaveBeenCalled();
  });

  it("rejects a forged session token", async () => {
    cookieJar.value = "9999999999.deadbeef";
    await expect(setLootStatus("page-1", "adopted")).rejects.toThrow(
      "unauthorized",
    );
    expect(updateSelect).not.toHaveBeenCalled();
  });

  it("rejects a status outside the whitelist (no stray Notion select option)", async () => {
    await expect(setLootStatus("page-1", "yolo")).rejects.toThrow(
      "invalid status",
    );
    expect(updateSelect).not.toHaveBeenCalled();
  });

  it("rejects a pageId that is not a loot row (arbitrary-page PATCH guard)", async () => {
    await expect(setLootStatus("not-a-loot-page", "adopted")).rejects.toThrow(
      "unknown loot page",
    );
    expect(updateSelect).not.toHaveBeenCalled();
  });

  it("checks every loot target's table and writes + busts the cache on success", async () => {
    await setLootStatus("page-1", "adopted");
    expect(fetchLoot).toHaveBeenCalledTimes(Object.keys(LOOT_TARGETS).length);
    expect(updateSelect).toHaveBeenCalledWith("page-1", "Status", "adopted");
    expect(updateTag).toHaveBeenCalledWith("notion:loot");
  });

  it("treats a failed table read as not containing the page (fail closed)", async () => {
    fetchLoot.mockResolvedValue({ ok: false, error: "boom" });
    await expect(setLootStatus("page-1", "adopted")).rejects.toThrow(
      "unknown loot page",
    );
    expect(updateSelect).not.toHaveBeenCalled();
  });
});
