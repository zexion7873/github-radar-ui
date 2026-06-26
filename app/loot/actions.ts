"use server";

import { cookies } from "next/headers";
import { updateTag } from "next/cache";
import { updateSelect, updateNumber } from "@/lib/notion";
import { fetchLoot } from "@/lib/data";
import { TABLES, LOOT_STATUSES } from "@/lib/config";
import { isAuthed } from "@/lib/auth";

// Notion's Status select options for loot rows. The action rejects anything else
// so a malformed POST can't spawn a stray option in Notion.
const STATUSES = new Set<string>(LOOT_STATUSES);

// proxy.ts does NOT cover Server Actions (they POST to their own route), so the
// session is verified here too — same constant-time check as the proxy gate.
async function assertAuthed() {
  if (!isAuthed((await cookies()).get("gh_radar")?.value)) {
    throw new Error("unauthorized");
  }
}

// Constrain writes to actual loot rows. pageId arrives from the client, so without
// this an authed user could PATCH any Notion page the integration token can reach.
// Reuses the cached loot reads (same `notion:loot` tag), so it's a cache hit in the
// common case rather than an extra Notion round-trip.
async function assertLootPage(pageId: string) {
  const [claude, copilot] = await Promise.all([
    fetchLoot(TABLES.lootClaude),
    fetchLoot(TABLES.lootCopilot),
  ]);
  const ids = new Set(
    [...(claude.ok ? claude.rows : []), ...(copilot.ok ? copilot.rows : [])].map(
      (r) => r.id,
    ),
  );
  if (!ids.has(pageId)) throw new Error("unknown loot page");
}

export async function setLootStatus(pageId: string, status: string) {
  await assertAuthed();
  if (!STATUSES.has(status)) throw new Error(`invalid status: ${status}`);
  await assertLootPage(pageId);

  await updateSelect(pageId, "Status", status);
  // updateTag (not revalidateTag) gives read-your-writes: the next read waits for
  // fresh data instead of serving the stale cache, so a reload shows the new Status.
  updateTag("notion:loot");
}

export async function setLootRecommendation(pageId: string, value: number) {
  await assertAuthed();
  if (!Number.isInteger(value) || value < 0 || value > 5) {
    throw new Error(`invalid rating: ${value}`);
  }
  await assertLootPage(pageId);

  await updateNumber(pageId, "Recommendation", value === 0 ? null : value);
  updateTag("notion:loot");
}
